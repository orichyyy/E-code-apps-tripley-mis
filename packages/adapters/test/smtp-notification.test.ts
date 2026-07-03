import { createServer, type Server } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { createSmtpNotificationChannelAdapter } from "../src/notification";

type FakeSmtpServer = {
  port: number;
  commands: string[];
  messages: string[];
  close: () => Promise<void>;
};

let activeServer: FakeSmtpServer | null = null;

afterEach(async () => {
  await activeServer?.close();
  activeServer = null;
});

describe("SMTP notification adapter", () => {
  it("sends email through SMTP commands", async () => {
    activeServer = await startFakeSmtpServer();
    const adapter = createSmtpNotificationChannelAdapter({
      host: "127.0.0.1",
      port: activeServer.port,
      secure: false,
      from: "sender@example.com",
      timeoutMs: 2_000
    });

    await adapter.send({
      channel: "email",
      recipient: "recipient@example.com",
      subject: "Hello",
      body: "Welcome to the admin system."
    });

    expect(activeServer.commands).toContain("MAIL FROM:<sender@example.com>");
    expect(activeServer.commands).toContain("RCPT TO:<recipient@example.com>");
    expect(activeServer.messages.join("\n")).toContain("Subject: Hello");
    expect(activeServer.messages.join("\n")).toContain("Welcome to the admin system.");
  });

  it("rejects non-email messages", async () => {
    const adapter = createSmtpNotificationChannelAdapter({
      host: "smtp.example.com",
      port: 25,
      secure: false,
      from: "sender@example.com"
    });

    await expect(
      adapter.send({
        channel: "webhook",
        recipient: "https://example.com/hook",
        body: "payload"
      })
    ).rejects.toThrow("only supports email");
  });
});

async function startFakeSmtpServer(): Promise<FakeSmtpServer> {
  const commands: string[] = [];
  const messages: string[] = [];
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    socket.write("220 fake.smtp.local ESMTP\r\n");

    let buffer = "";
    let collectingData = false;
    let message = "";

    socket.on("data", (chunk: string) => {
      buffer += chunk;
      let newlineIndex = buffer.indexOf("\r\n");

      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 2);

        if (collectingData) {
          if (line === ".") {
            messages.push(message);
            message = "";
            collectingData = false;
            socket.write("250 queued\r\n");
          } else {
            message += `${line}\n`;
          }
        } else {
          commands.push(line);
          if (line.startsWith("EHLO")) socket.write("250-fake.smtp.local\r\n250 AUTH LOGIN\r\n");
          else if (line === "DATA") {
            collectingData = true;
            socket.write("354 end with dot\r\n");
          } else if (line === "QUIT") {
            socket.write("221 bye\r\n");
            socket.end();
          } else {
            socket.write("250 ok\r\n");
          }
        }

        newlineIndex = buffer.indexOf("\r\n");
      }
    });
  });

  await listen(server);
  const address = server.address();
  if (typeof address !== "object" || !address) throw new Error("Fake SMTP server did not expose a port.");

  return {
    port: address.port,
    commands,
    messages,
    close: () => close(server)
  };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
