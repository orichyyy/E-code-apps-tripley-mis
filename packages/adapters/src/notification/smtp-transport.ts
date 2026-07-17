import { Buffer } from "node:buffer";
import net, { type Socket } from "node:net";
import tls, { type TLSSocket } from "node:tls";

import type { AdapterHealth } from "../health";

export type SmtpNotificationConfig = {
  host: string;
  port: number;
  secure: boolean;
  from: string;
  username?: string | null;
  password?: string | null;
  timeoutMs?: number;
  allowInsecureLocalhost?: boolean;
};

export type SmtpTransportMessage = {
  from: string;
  recipient: string;
  subject?: string;
  body: string;
  messageId: string;
};

export type SmtpTransport = {
  send: (message: SmtpTransportMessage, config: SmtpNotificationConfig) => Promise<void>;
  healthCheck?: () => Promise<AdapterHealth>;
};

export class SmtpDeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly smtpCode: number | null = null,
  ) {
    super(safeSmtpErrorMessage(code, smtpCode));
    this.name = "SmtpDeliveryError";
  }
}

type SmtpSocket = Socket | TLSSocket;
type SmtpResponse = { code: number; text: string };
export function createNodeSmtpTransport(): SmtpTransport {
  return {
    async send(message, config) {
      let client: SmtpClient | null = null;
      try {
        client = await SmtpClient.connect(config);
        await client.expect([220]);
        let hello = await client.command(`EHLO ${ehloDomain()}`, [250]);
        if (!config.secure) {
          if (supportsStartTls(hello)) {
            await client.command("STARTTLS", [220]);
            await client.upgradeToTls(config.host);
            hello = await client.command(`EHLO ${ehloDomain()}`, [250]);
          } else if (!(config.allowInsecureLocalhost && isLoopbackHost(config.host))) {
            throw new SmtpDeliveryError("SMTP_STARTTLS_REQUIRED", false);
          }
        }
        if (config.username && config.password) {
          await client.command("AUTH LOGIN", [334]);
          await client.command(Buffer.from(config.username).toString("base64"), [334]);
          await client.command(Buffer.from(config.password).toString("base64"), [235]);
        }
        await client.command(`MAIL FROM:<${smtpPath(message.from)}>`, [250]);
        await client.command(`RCPT TO:<${smtpPath(message.recipient)}>`, [250, 251]);
        await client.command("DATA", [354]);
        await client.writeData(formatEmailMessage(message));
        await client.expect([250]);
        await client.command("QUIT", [221]);
      } catch (error) {
        throw classifySmtpError(error);
      } finally {
        client?.close();
      }
    },
  };
}

export function classifySmtpError(error: unknown): SmtpDeliveryError {
  if (error instanceof SmtpDeliveryError) return error;
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (/CERT|TLS|SSL|ERR_TLS/i.test(code)) {
    return new SmtpDeliveryError("SMTP_TLS_VALIDATION_FAILED", false);
  }
  if (/ECONN|ETIMEDOUT|ETIMEOUT|ENOTFOUND|EAI_AGAIN|EPIPE/i.test(code)) {
    return new SmtpDeliveryError("SMTP_NETWORK_ERROR", true);
  }
  return new SmtpDeliveryError("SMTP_PROTOCOL_ERROR", false);
}

class SmtpClient {
  private buffer = "";

  private constructor(
    private socket: SmtpSocket,
    private readonly timeoutMs: number,
  ) {
    this.socket.setEncoding("utf8");
  }

  static connect(config: SmtpNotificationConfig): Promise<SmtpClient> {
    const timeoutMs = config.timeoutMs ?? 10_000;
    return new Promise((resolve, reject) => {
      const socket = config.secure
        ? tls.connect({ host: config.host, port: config.port, servername: config.host })
        : net.connect({ host: config.host, port: config.port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new SmtpDeliveryError("SMTP_CONNECTION_TIMEOUT", true));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        socket.off("connect", onConnect);
        socket.off("secureConnect", onConnect);
        socket.off("error", onError);
      };
      const onConnect = () => {
        cleanup();
        resolve(new SmtpClient(socket, timeoutMs));
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      socket.once(config.secure ? "secureConnect" : "connect", onConnect);
      socket.once("error", onError);
    });
  }

  command(command: string, expectedCodes: number[]): Promise<SmtpResponse> {
    this.socket.write(`${command}\r\n`);
    return this.expect(expectedCodes);
  }

  writeData(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.write(`${data}\r\n.\r\n`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  expect(expectedCodes: number[]): Promise<SmtpResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new SmtpDeliveryError("SMTP_RESPONSE_TIMEOUT", true));
      }, this.timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off("data", onData);
        this.socket.off("error", onError);
      };
      const finish = (response: SmtpResponse) => {
        cleanup();
        if (expectedCodes.includes(response.code)) resolve(response);
        else reject(responseError(response.code));
      };
      const onData = (chunk: string) => {
        this.buffer += chunk;
        const parsed = consumeSmtpResponse(this.buffer);
        if (!parsed) return;
        this.buffer = parsed.remaining;
        finish(parsed.response);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const parsed = consumeSmtpResponse(this.buffer);
      if (parsed) {
        this.buffer = parsed.remaining;
        finish(parsed.response);
        return;
      }
      this.socket.on("data", onData);
      this.socket.once("error", onError);
    });
  }

  upgradeToTls(host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect({ socket: this.socket, servername: host });
      const timer = setTimeout(() => {
        cleanup();
        socket.destroy();
        reject(new SmtpDeliveryError("SMTP_TLS_TIMEOUT", false));
      }, this.timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        socket.off("secureConnect", onSecure);
        socket.off("error", onError);
      };
      const onSecure = () => {
        cleanup();
        this.socket = socket;
        this.socket.setEncoding("utf8");
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      socket.once("secureConnect", onSecure);
      socket.once("error", onError);
    });
  }

  close(): void {
    this.socket.destroy();
  }
}

function responseError(code: number): SmtpDeliveryError {
  return new SmtpDeliveryError(
    code >= 400 && code < 500 ? "SMTP_TRANSIENT_RESPONSE" : "SMTP_PERMANENT_RESPONSE",
    code >= 400 && code < 500,
    code,
  );
}

function safeSmtpErrorMessage(code: string, smtpCode: number | null): string {
  return smtpCode == null ? code : `${code} (${smtpCode})`;
}

function supportsStartTls(response: SmtpResponse): boolean {
  return response.text.split("\n").some((line) => /^250[ -]STARTTLS\b/i.test(line));
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "::1" || normalized.startsWith("127.");
}

function consumeSmtpResponse(buffer: string): { response: SmtpResponse; remaining: string } | null {
  const lines = buffer.split(/\r\n/);
  if (lines.length < 2) return null;
  const completeLines = lines.slice(0, -1);
  const code = Number(completeLines[0]?.slice(0, 3));
  if (!Number.isInteger(code)) return null;
  for (let index = 0; index < completeLines.length; index += 1) {
    if ((completeLines[index] ?? "").startsWith(`${code} `)) {
      const consumed = completeLines.slice(0, index + 1).join("\r\n").length + 2;
      return {
        response: { code, text: completeLines.slice(0, index + 1).join("\n") },
        remaining: buffer.slice(consumed),
      };
    }
  }
  return null;
}

function formatEmailMessage(message: SmtpTransportMessage): string {
  const headers = [
    `From: ${sanitizeHeader(message.from)}`,
    `To: ${sanitizeHeader(message.recipient)}`,
    `Subject: ${encodeHeaderValue(message.subject ?? "")}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${sanitizeHeader(message.messageId)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];
  return [...headers, "", dotStuff(message.body)].join("\r\n");
}

function smtpPath(value: string): string {
  const matched = value.match(/<([^>]+)>/);
  return sanitizeHeader((matched?.[1] ?? value).trim());
}

function encodeHeaderValue(value: string): string {
  const sanitized = sanitizeHeader(value);
  return isAscii(sanitized)
    ? sanitized
    : `=?UTF-8?B?${Buffer.from(sanitized, "utf8").toString("base64")}?=`;
}

function isAscii(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 127) return false;
  }
  return true;
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function dotStuff(body: string): string {
  return body.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function ehloDomain(): string {
  return "localhost";
}
