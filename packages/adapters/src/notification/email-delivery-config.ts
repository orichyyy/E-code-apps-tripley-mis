import { z } from "zod";

const booleanString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().min(1).nullable().default(null),
);

const deliverySchema = z.object({
  enabled: booleanString.default("false"),
  concurrency: z.coerce.number().int().min(1).max(32).default(4),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(5),
  retentionDays: z.coerce.number().int().min(1).max(3650).default(90),
  staleSeconds: z.coerce.number().int().min(60).max(86_400).default(900),
  contentKeys: optionalString,
  activeKeyId: optionalString,
});

const smtpSchema = z.object({
  enabled: booleanString.default("false"),
  host: optionalString,
  port: z.coerce.number().int().min(1).max(65_535).default(587),
  secure: booleanString.default("false"),
  allowInsecureLocalhost: booleanString.default("false"),
  username: optionalString,
  password: optionalString,
  from: optionalString,
  timeoutMs: z.coerce.number().int().min(100).max(120_000).default(10_000),
});

export type EmailContentKeyring = ReadonlyMap<string, Uint8Array>;
export type EmailDeliveryConfig = Omit<z.infer<typeof deliverySchema>, "contentKeys"> & {
  contentKeys: EmailContentKeyring;
};
export type SmtpRuntimeConfig = z.infer<typeof smtpSchema>;

export function loadEmailDeliveryConfig(env: NodeJS.ProcessEnv = process.env): EmailDeliveryConfig {
  const parsed = deliverySchema.parse({
    enabled: env.EMAIL_DELIVERY_ENABLED,
    concurrency: env.EMAIL_DELIVERY_CONCURRENCY,
    maxAttempts: env.EMAIL_DELIVERY_MAX_ATTEMPTS,
    retentionDays: env.EMAIL_DELIVERY_RETENTION_DAYS,
    staleSeconds: env.EMAIL_DELIVERY_STALE_SECONDS,
    contentKeys: env.EMAIL_CONTENT_KEYS,
    activeKeyId: env.EMAIL_CONTENT_ACTIVE_KEY_ID,
  });
  const contentKeys = parseEmailContentKeys(parsed.contentKeys);
  if (parsed.enabled && (!parsed.activeKeyId || !contentKeys.has(parsed.activeKeyId))) {
    throw new Error(
      "EMAIL_CONTENT_ACTIVE_KEY_ID must reference EMAIL_CONTENT_KEYS when email delivery is enabled.",
    );
  }
  return { ...parsed, contentKeys };
}

export function loadSmtpRuntimeConfig(env: NodeJS.ProcessEnv = process.env): SmtpRuntimeConfig {
  const parsed = smtpSchema.parse({
    enabled: env.SMTP_ENABLED,
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    allowInsecureLocalhost: env.SMTP_ALLOW_INSECURE_LOCALHOST,
    username: env.SMTP_USERNAME,
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM,
    timeoutMs: env.SMTP_TIMEOUT_MS,
  });
  if (parsed.allowInsecureLocalhost && env.NODE_ENV === "production") {
    throw new Error("SMTP_ALLOW_INSECURE_LOCALHOST is forbidden in production.");
  }
  if (Boolean(parsed.username) !== Boolean(parsed.password)) {
    throw new Error("SMTP_USERNAME and SMTP_PASSWORD must be configured together.");
  }
  if (parsed.enabled && (!parsed.host || !parsed.from)) {
    throw new Error("SMTP_HOST and SMTP_FROM are required when SMTP_ENABLED is true.");
  }
  return parsed;
}

export function parseEmailContentKeys(value: string | null): EmailContentKeyring {
  if (!value) return new Map();
  let record: unknown;
  try {
    record = JSON.parse(value);
  } catch {
    throw new Error("EMAIL_CONTENT_KEYS must be a JSON object.");
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("EMAIL_CONTENT_KEYS must be a JSON object.");
  }
  const result = new Map<string, Uint8Array>();
  for (const [keyId, encoded] of Object.entries(record)) {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(keyId) || typeof encoded !== "string") {
      throw new Error("EMAIL_CONTENT_KEYS contains an invalid key ID or value.");
    }
    const key = Buffer.from(encoded, "base64");
    if (key.byteLength !== 32 || key.toString("base64") !== encoded) {
      throw new Error(`Email content key ${keyId} must be canonical Base64 for 32 bytes.`);
    }
    result.set(keyId, key);
  }
  return result;
}
