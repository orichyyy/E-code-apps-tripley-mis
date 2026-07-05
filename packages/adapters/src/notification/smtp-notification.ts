import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import net, { type Socket } from "node:net";
import tls, { type TLSSocket } from "node:tls";

import type { AdapterHealth } from "../health";
import type { NotificationChannelAdapter, NotificationMessage } from ".";

export type SmtpNotificationConfig = {
  host: string;
  port: number;
  secure: boolean;
  from: string;
  username?: string | null;
  password?: string | null;
  timeoutMs?: number;
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

type SmtpSocket = Socket | TLSSocket;

type SmtpResponse = {
  code: number;
  text: string;
};

export function createSmtpNotificationChannelAdapter(
  config: SmtpNotificationConfig,
  transport: SmtpTransport = createNodeSmtpTransport(),
): NotificationChannelAdapter {
  return {
    async healthCheck() {
      if (transport.healthCheck) return transport.healthCheck();
      return {
        ok: Boolean(config.host && config.port > 0 && config.from),
        details: { host: config.host, port: config.port, secure: config.secure },
      };
    },
    async send(message: NotificationMessage) {
      if (message.channel !== "email") {
        throw new Error(
          `SMTP notification channel only supports email messages, received ${message.channel}.`,
        );
      }

      await transport.send(
        {
          from: config.from,
          recipient: message.recipient,
          subject: message.subject,
          body: message.body,
          messageId: `<${randomUUID()}@web-admin-base.local>`,
        },
        config,
      );
    },
  };
}

export function createNodeSmtpTransport(): SmtpTransport {
  return {
    async send(message, config) {
      const client = await SmtpClient.connect(config);
      try {
        await client.expect([220]);
        await client.command(`EHLO ${ehloDomain()}`, [250]);
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
      } finally {
        client.close();
      }
    },
  };
}

class SmtpClient {
  private buffer = "";

  private constructor(
    private readonly socket: SmtpSocket,
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
        reject(new Error(`SMTP connection timed out after ${timeoutMs}ms.`));
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
        reject(new Error(`SMTP response timed out after ${this.timeoutMs}ms.`));
      }, this.timeoutMs);

      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off("data", onData);
        this.socket.off("error", onError);
      };
      const finish = (response: SmtpResponse) => {
        cleanup();
        if (expectedCodes.includes(response.code)) resolve(response);
        else reject(new Error(`Unexpected SMTP response ${response.code}: ${response.text}`));
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

  close(): void {
    this.socket.destroy();
  }
}

function consumeSmtpResponse(buffer: string): { response: SmtpResponse; remaining: string } | null {
  const lines = buffer.split(/\r\n/);
  if (lines.length < 2) return null;

  const completeLines = lines.slice(0, -1);
  const first = completeLines[0];
  const code = Number(first?.slice(0, 3));
  if (!Number.isInteger(code)) return null;

  for (let index = 0; index < completeLines.length; index += 1) {
    const line = completeLines[index] ?? "";
    if (line.startsWith(`${code} `)) {
      const consumed = completeLines.slice(0, index + 1).join("\r\n").length + 2;
      return {
        response: {
          code,
          text: completeLines.slice(0, index + 1).join("\n"),
        },
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
