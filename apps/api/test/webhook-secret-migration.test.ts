import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

import {
  decryptWebhookSecret,
  encryptWebhookSecret,
  loadWebhookDeliveryConfig,
} from "@web-admin-base/adapters";
import { runSqliteMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { migrateWebhookSecrets } from "../src/webhook-secret-migration";
import { createSqliteInfrastructureExecutor } from "../src/modules/infrastructure/infrastructure.executor";

describe("webhook secret migration", () => {
  it("scans safely, then encrypts plaintext and rotates old keys", async () => {
    const filename = join(tmpdir(), `webhook-secrets-${process.pid}-${Date.now()}.sqlite`);
    const url = `file:${filename}`;
    runSqliteMigrations({ url });
    const executor = createSqliteInfrastructureExecutor(url);
    const oldKey = randomBytes(32);
    const activeKey = randomBytes(32);
    const config = loadWebhookDeliveryConfig({
      NODE_ENV: "test",
      WEBHOOK_SECRET_KEYS: JSON.stringify({
        old: oldKey.toString("base64"),
        active: activeKey.toString("base64"),
      }),
      WEBHOOK_SECRET_ACTIVE_KEY_ID: "active",
    });
    const messages: string[] = [];
    try {
      const now = new Date().toISOString();
      for (const [name, secret] of [
        ["plaintext", "plain-value"],
        ["old", encryptWebhookSecret("old-value", "old", config.secretKeys)],
        ["current", encryptWebhookSecret("current-value", "active", config.secretKeys)],
        ["unreadable", "enc:v1:missing:a:b:c"],
      ]) {
        await executor.run(
          `INSERT INTO webhook_subscriptions
           (name, url, event_types, secret, status, is_deleted, created_at, updated_at)
           VALUES (?, 'https://example.com/hook', '["user.created"]', ?, 'enabled', 0, ?, ?)`,
          [name, secret, now, now],
        );
      }

      await expect(
        migrateWebhookSecrets(executor, config, false, (line) => messages.push(line)),
      ).resolves.toEqual({ plaintext: 1, oldKey: 1, current: 1, unreadable: 1, changed: 0 });
      expect(messages.join("\n")).not.toContain("plain-value");
      expect(
        String(
          (
            await executor.all("SELECT secret FROM webhook_subscriptions WHERE name = 'plaintext'")
          )[0]?.secret,
        ),
      ).toBe("plain-value");

      messages.length = 0;
      await expect(
        migrateWebhookSecrets(executor, config, true, (line) => messages.push(line)),
      ).resolves.toEqual({ plaintext: 1, oldKey: 1, current: 1, unreadable: 1, changed: 2 });
      const migrated = await executor.all(
        "SELECT name, secret FROM webhook_subscriptions WHERE name IN ('plaintext', 'old') ORDER BY name",
      );
      expect(migrated).toHaveLength(2);
      for (const row of migrated) {
        expect(String(row.secret)).toMatch(/^enc:v1:active:/);
        expect(decryptWebhookSecret(String(row.secret), config.secretKeys)).toBe(
          row.name === "old" ? "old-value" : "plain-value",
        );
      }
      expect(messages.join("\n")).not.toContain("old-value");
    } finally {
      await executor.close();
      if (existsSync(filename)) rmSync(filename, { force: true });
    }
  });
});
