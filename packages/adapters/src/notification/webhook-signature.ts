import { createHmac } from "node:crypto";

export function createWebhookSignature(secret: string, timestamp: number, rawBody: string): string {
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return `v1=${digest}`;
}
