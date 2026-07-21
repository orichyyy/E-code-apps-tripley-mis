import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  decryptEmailContent,
  emailContentKeyId,
  encryptEmailContent,
  loadEmailDeliveryConfig,
  loadSmtpRuntimeConfig,
} from "../src";

describe("email delivery configuration and content encryption", () => {
  it("requires a configured active key only when reliable delivery is enabled", () => {
    expect(loadEmailDeliveryConfig({}).enabled).toBe(false);
    expect(() => loadEmailDeliveryConfig({ EMAIL_DELIVERY_ENABLED: "true" })).toThrow();
    const encoded = randomBytes(32).toString("base64");
    const config = loadEmailDeliveryConfig({
      EMAIL_DELIVERY_ENABLED: "true",
      EMAIL_CONTENT_KEYS: JSON.stringify({ primary: encoded }),
      EMAIL_CONTENT_ACTIVE_KEY_ID: "primary",
    });
    expect(config.contentKeys.get("primary")).toHaveLength(32);
  });

  it("validates SMTP security and credential pairs", () => {
    expect(() => loadSmtpRuntimeConfig({ SMTP_USERNAME: "user", SMTP_PASSWORD: "" })).toThrow(
      /together/,
    );
    expect(() =>
      loadSmtpRuntimeConfig({
        NODE_ENV: "production",
        SMTP_ALLOW_INSECURE_LOCALHOST: "true",
      }),
    ).toThrow(/forbidden/);
  });

  it("round-trips an authenticated email content snapshot", () => {
    const keyring = new Map([["primary", randomBytes(32)]]);
    const snapshot = { recipient: "ada@example.com", subject: "Hello", body: "Welcome" };
    const envelope = encryptEmailContent(snapshot, "primary", keyring);
    expect(envelope).not.toContain(snapshot.recipient);
    expect(emailContentKeyId(envelope)).toBe("primary");
    expect(decryptEmailContent(envelope, keyring)).toEqual(snapshot);
  });
});
