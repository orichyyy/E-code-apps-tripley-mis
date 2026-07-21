import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  decryptEmailContent,
  encryptEmailContent,
  loadEmailDeliveryConfig,
} from "@web-admin-base/adapters";
import { runSqliteMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { migrateEmailContentKeys } from "../src/email-content-key-migration";
import { parseEmailDeliveryRequestArgs } from "../src/email-delivery-request";
import { createSqliteInfrastructureExecutor } from "../src/modules/infrastructure/infrastructure.executor";

describe("email delivery operational tooling", () => {
  it("scans and rotates unfinished content without logging plaintext", async () => {
    const filename = join(tmpdir(), `email-keys-${process.pid}-${Date.now()}.sqlite`);
    const url = `file:${filename}`;
    runSqliteMigrations({ url });
    const executor = createSqliteInfrastructureExecutor(url);
    const old = Buffer.alloc(32, 1).toString("base64");
    const active = Buffer.alloc(32, 2).toString("base64");
    const config = loadEmailDeliveryConfig({
      EMAIL_DELIVERY_ENABLED: "true",
      EMAIL_CONTENT_KEYS: JSON.stringify({ old, active }),
      EMAIL_CONTENT_ACTIVE_KEY_ID: "active",
    });
    const snapshot = { recipient: "private@example.com", subject: "Private", body: "Secret" };
    const messages: string[] = [];
    try {
      await seedDelivery(executor, "old", encryptEmailContent(snapshot, "old", config.contentKeys));
      expect(
        await migrateEmailContentKeys(executor, config, false, messages.push.bind(messages)),
      ).toMatchObject({ oldKey: 1, changed: 0 });
      expect(messages.join(" ")).not.toContain("private@example.com");

      expect(
        await migrateEmailContentKeys(executor, config, true, messages.push.bind(messages)),
      ).toMatchObject({ oldKey: 1, changed: 1 });
      const rows = await executor.all(
        "SELECT content_key_id, content_envelope FROM email_deliveries",
      );
      expect(rows[0]?.content_key_id).toBe("active");
      expect(decryptEmailContent(String(rows[0]?.content_envelope), config.contentKeys)).toEqual(
        snapshot,
      );
    } finally {
      await executor.close();
      if (existsSync(filename)) rmSync(filename, { force: true });
    }
  });

  it("parses the development request CLI contract", () => {
    expect(
      parseEmailDeliveryRequestArgs([
        "--request-key",
        "request-1",
        "--user-id",
        "7",
        "--template-code",
        "notice",
        "--variables",
        '{"name":"Ada"}',
      ]),
    ).toMatchObject({ requestKey: "request-1", userId: "7", variables: { name: "Ada" } });
  });
});

async function seedDelivery(
  executor: { run(sql: string, params?: unknown[]): Promise<void> },
  keyId: string,
  envelope: string,
) {
  const now = new Date().toISOString();
  await executor.run(
    `INSERT INTO email_deliveries
     (request_key, request_fingerprint, user_id, template_id, template_code, locale,
      template_updated_at, masked_recipient, message_id, content_key_id, content_envelope,
      status, attempt, max_attempts, next_attempt_at, created_at, updated_at)
     VALUES ('key-test', 'fingerprint', 1, 1, 'notice', 'en', ?, 'p***@example.com',
      '<key-test@local>', ?, ?, 'pending', 0, 5, ?, ?, ?)`,
    [now, keyId, envelope, now, now, now],
  );
}
