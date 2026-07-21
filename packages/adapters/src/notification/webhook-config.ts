import { z } from "zod";

const booleanString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().min(1).nullable().default(null),
);

const rawConfigSchema = z.object({
  enabled: booleanString.default("false"),
  eventSource: z.string().min(1).default("web-admin-base-system"),
  requestTimeoutMs: z.coerce.number().int().min(100).max(120_000).default(10_000),
  maxAttempts: z.coerce.number().int().min(1).max(20).default(5),
  concurrency: z.coerce.number().int().min(1).max(32).default(4),
  retentionDays: z.coerce.number().int().min(1).max(3650).default(90),
  allowedHosts: z.string().default(""),
  allowInsecureLocalhost: booleanString.default("false"),
  secretKeys: optionalString,
  activeKeyId: optionalString,
});

export type WebhookSecretKeyring = ReadonlyMap<string, Uint8Array>;

export type WebhookDeliveryConfig = Omit<
  z.infer<typeof rawConfigSchema>,
  "allowedHosts" | "secretKeys"
> & {
  allowedHosts: ReadonlySet<string>;
  secretKeys: WebhookSecretKeyring;
};

export function loadWebhookDeliveryConfig(
  env: NodeJS.ProcessEnv = process.env,
): WebhookDeliveryConfig {
  const parsed = rawConfigSchema.parse({
    enabled: env.WEBHOOK_DELIVERY_ENABLED,
    eventSource: env.WEBHOOK_EVENT_SOURCE,
    requestTimeoutMs: env.WEBHOOK_REQUEST_TIMEOUT_MS,
    maxAttempts: env.WEBHOOK_MAX_ATTEMPTS,
    concurrency: env.WEBHOOK_DELIVERY_CONCURRENCY,
    retentionDays: env.WEBHOOK_DELIVERY_RETENTION_DAYS,
    allowedHosts: env.WEBHOOK_ALLOWED_HOSTS,
    allowInsecureLocalhost: env.WEBHOOK_ALLOW_INSECURE_LOCALHOST,
    secretKeys: env.WEBHOOK_SECRET_KEYS,
    activeKeyId: env.WEBHOOK_SECRET_ACTIVE_KEY_ID,
  });
  if (parsed.allowInsecureLocalhost && env.NODE_ENV === "production") {
    throw new Error("WEBHOOK_ALLOW_INSECURE_LOCALHOST is forbidden in production.");
  }
  const secretKeys = parseWebhookSecretKeys(parsed.secretKeys);
  if (parsed.activeKeyId && !secretKeys.has(parsed.activeKeyId)) {
    throw new Error("WEBHOOK_SECRET_ACTIVE_KEY_ID must exist in WEBHOOK_SECRET_KEYS.");
  }
  if (parsed.enabled && secretKeys.size > 0 && !parsed.activeKeyId) {
    throw new Error("WEBHOOK_SECRET_ACTIVE_KEY_ID is required when delivery uses a keyring.");
  }
  return {
    ...parsed,
    allowedHosts: new Set(
      parsed.allowedHosts
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean),
    ),
    secretKeys,
  };
}

export function parseWebhookSecretKeys(value: string | null): WebhookSecretKeyring {
  if (!value) return new Map();
  let record: unknown;
  try {
    record = JSON.parse(value);
  } catch {
    throw new Error("WEBHOOK_SECRET_KEYS must be a JSON object.");
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("WEBHOOK_SECRET_KEYS must be a JSON object.");
  }
  const result = new Map<string, Uint8Array>();
  for (const [keyId, encoded] of Object.entries(record)) {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(keyId) || typeof encoded !== "string") {
      throw new Error("WEBHOOK_SECRET_KEYS contains an invalid key ID or value.");
    }
    const key = Buffer.from(encoded, "base64");
    if (key.byteLength !== 32 || key.toString("base64") !== encoded) {
      throw new Error(`Webhook secret key ${keyId} must be canonical Base64 for 32 bytes.`);
    }
    result.set(keyId, key);
  }
  return result;
}
