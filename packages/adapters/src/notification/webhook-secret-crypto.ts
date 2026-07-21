import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { WebhookSecretKeyring } from "./webhook-config";

const envelopePrefix = "enc:v1:";

export function isEncryptedWebhookSecret(value: string): boolean {
  return value.startsWith(envelopePrefix);
}

export function encryptWebhookSecret(
  secret: string,
  keyId: string,
  keyring: WebhookSecretKeyring,
): string {
  const key = requireKey(keyring, keyId);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [
    "enc",
    "v1",
    keyId,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(":");
}

export function decryptWebhookSecret(envelope: string, keyring: WebhookSecretKeyring): string {
  const parts = envelope.split(":");
  if (parts.length !== 6 || parts[0] !== "enc" || parts[1] !== "v1") {
    throw new Error("Webhook secret is not encrypted with a supported envelope.");
  }
  const key = requireKey(keyring, parts[2] ?? "");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[3] ?? "", "base64url"));
  decipher.setAuthTag(Buffer.from(parts[5] ?? "", "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(parts[4] ?? "", "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function webhookSecretKeyId(envelope: string): string | null {
  if (!isEncryptedWebhookSecret(envelope)) return null;
  return envelope.split(":")[2] ?? null;
}

function requireKey(keyring: WebhookSecretKeyring, keyId: string): Uint8Array {
  const key = keyring.get(keyId);
  if (!key) throw new Error(`Webhook secret key ${keyId || "<missing>"} is unavailable.`);
  return key;
}
