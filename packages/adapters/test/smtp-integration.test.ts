import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createSmtpNotificationChannelAdapter } from "../src";

const required = process.env.SMTP_INTEGRATION_REQUIRED === "true";

describe("Mailpit SMTP compatibility", () => {
  it.runIf(required)("delivers UTF-8 plain text with a stable message id", async () => {
    const subject = `SMTP compatibility ${randomUUID()}`;
    const messageId = `<${randomUUID()}@integration.local>`;
    const adapter = createSmtpNotificationChannelAdapter({
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: false,
      allowInsecureLocalhost: false,
      from: "sender@example.com",
      timeoutMs: 5_000,
    });
    await adapter.send({
      channel: "email",
      recipient: "recipient@example.com",
      subject,
      body: "Mailpit compatibility body.",
      messageId,
    });

    const message = await waitForMessage(subject);
    expect(message.Subject).toBe(subject);
    expect(message.MessageID).toContain(messageId.slice(1, -1));
  });
});

async function waitForMessage(subject: string): Promise<Record<string, unknown>> {
  const baseUrl = process.env.MAILPIT_API_URL ?? "http://127.0.0.1:8025";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/v1/messages`);
    if (!response.ok) throw new Error(`Mailpit API returned ${response.status}.`);
    const payload = (await response.json()) as { messages?: Array<Record<string, unknown>> };
    const found = payload.messages?.find((message) => message.Subject === subject);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Mailpit did not receive the SMTP compatibility message.");
}
