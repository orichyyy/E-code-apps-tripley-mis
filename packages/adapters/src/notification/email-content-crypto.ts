import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { EmailContentKeyring } from "./email-delivery-config";

export type EmailContentSnapshot = {
  recipient: string;
  subject: string;
  body: string;
};

export function encryptEmailContent(
  snapshot: EmailContentSnapshot,
  keyId: string,
  keyring: EmailContentKeyring,
): string {
  const key = requireKey(keyring, keyId);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(snapshot), "utf8"),
    cipher.final(),
  ]);
  return [
    "email",
    "v1",
    keyId,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(":");
}

export function decryptEmailContent(
  envelope: string,
  keyring: EmailContentKeyring,
): EmailContentSnapshot {
  const parts = envelope.split(":");
  if (parts.length !== 6 || parts[0] !== "email" || parts[1] !== "v1") {
    throw new Error("Email content is not encrypted with a supported envelope.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    requireKey(keyring, parts[2] ?? ""),
    Buffer.from(parts[3] ?? "", "base64url"),
  );
  decipher.setAuthTag(Buffer.from(parts[5] ?? "", "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parts[4] ?? "", "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return parseSnapshot(plaintext);
}

export function emailContentKeyId(envelope: string): string | null {
  const parts = envelope.split(":");
  return parts.length === 6 && parts[0] === "email" && parts[1] === "v1"
    ? (parts[2] ?? null)
    : null;
}

function requireKey(keyring: EmailContentKeyring, keyId: string): Uint8Array {
  const key = keyring.get(keyId);
  if (!key) throw new Error(`Email content key ${keyId || "<missing>"} is unavailable.`);
  return key;
}

function parseSnapshot(value: string): EmailContentSnapshot {
  const parsed = JSON.parse(value) as Partial<EmailContentSnapshot>;
  if (
    typeof parsed.recipient !== "string" ||
    typeof parsed.subject !== "string" ||
    typeof parsed.body !== "string"
  ) {
    throw new Error("Email content envelope has an invalid payload.");
  }
  return { recipient: parsed.recipient, subject: parsed.subject, body: parsed.body };
}
