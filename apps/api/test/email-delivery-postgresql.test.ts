import { randomUUID } from "node:crypto";

import { loadEmailDeliveryConfig } from "@web-admin-base/adapters";
import { runPostgresqlMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { EmailDeliveryRepository } from "../src/modules/infrastructure/email-delivery.repository";
import { EmailDeliveryService } from "../src/modules/infrastructure/email-delivery.service";
import { createPostgresqlInfrastructureExecutor } from "../src/modules/infrastructure/infrastructure.executor";

const postgresqlUrl = process.env.TEST_DATABASE_URL;

describe("reliable email delivery PostgreSQL persistence", () => {
  it.runIf(postgresqlUrl)("persists idempotent encrypted requests and safe history", async () => {
    const url = requirePostgresqlUrl();
    await runPostgresqlMigrations({ url });
    const executor = createPostgresqlInfrastructureExecutor(url);
    const suffix = randomUUID();
    const key = Buffer.alloc(32, 9).toString("base64");
    try {
      const now = new Date().toISOString();
      await executor.run(
        `INSERT INTO users
         (username, display_name, email, phone, password_hash, status,
          first_login_password_change_required, failed_login_attempts, token_version,
          is_deleted, created_at, updated_at)
         VALUES ($1, 'PG Email User', $2, $3, 'hash', 'enabled', FALSE, 0, 0, FALSE, $4, $5)`,
        [`email-${suffix}`, `email-${suffix}@example.com`, suffix, now, now],
      );
      const users = await executor.all("SELECT id FROM users WHERE username = $1", [
        `email-${suffix}`,
      ]);
      const userId = String(users[0]?.id);
      await executor.run(
        `INSERT INTO user_preferences
         (user_id, language, theme_mode, theme_color, page_tabs_enabled, updated_at)
         VALUES ($1, 'en', 'light', 'blue', TRUE, $2)`,
        [userId, now],
      );
      await executor.run(
        `INSERT INTO notification_templates
         (code, channel, locale, subject, body, variables_json, status, created_at, updated_at)
         VALUES ($1, 'email', 'en', 'Hello {{name}}', 'Body {{name}}', $2, 'enabled', $3, $4)`,
        [`pg-email-${suffix}`, JSON.stringify(["name"]), now, now],
      );
      const config = loadEmailDeliveryConfig({
        EMAIL_DELIVERY_ENABLED: "true",
        EMAIL_CONTENT_KEYS: JSON.stringify({ primary: key }),
        EMAIL_CONTENT_ACTIVE_KEY_ID: "primary",
      });
      const service = new EmailDeliveryService(new EmailDeliveryRepository(executor), config);
      const request = {
        requestKey: `request-${suffix}`,
        userId,
        templateCode: `pg-email-${suffix}`,
        variables: { name: "Ada" },
      };

      const first = await service.request(request);
      const replay = await service.request(request);
      const detail = await service.get(first.id);

      expect(replay.id).toBe(first.id);
      expect(detail?.id).toBe(first.id);
      expect(JSON.stringify(detail)).not.toContain(`email-${suffix}@example.com`);
      const persisted = await executor.all(
        "SELECT content_key_id, content_envelope FROM email_deliveries WHERE id = $1",
        [first.id],
      );
      expect(persisted[0]?.content_key_id).toBe("primary");
      expect(String(persisted[0]?.content_envelope)).toMatch(/^email:v1:primary:/);

      await expect(
        service.request({ ...request, variables: { name: "Grace" } }),
      ).rejects.toMatchObject({ code: "BUSINESS_EMAIL_IDEMPOTENCY_CONFLICT" });
      await executor.run("UPDATE user_preferences SET language = 'zh' WHERE user_id = $1", [
        userId,
      ]);
      await expect(
        service.request({ ...request, requestKey: `locale-${suffix}` }),
      ).rejects.toMatchObject({ code: "VALIDATION_EMAIL_TEMPLATE_UNAVAILABLE" });
      await executor.run("UPDATE users SET status = 'disabled' WHERE id = $1", [userId]);
      await expect(
        service.request({ ...request, requestKey: `disabled-${suffix}` }),
      ).rejects.toMatchObject({ code: "BUSINESS_EMAIL_RECIPIENT_INELIGIBLE" });
    } finally {
      await executor.run(
        `DELETE FROM email_delivery_attempts WHERE delivery_id IN
         (SELECT id FROM email_deliveries WHERE request_key = $1)`,
        [`request-${suffix}`],
      );
      await executor.run("DELETE FROM email_deliveries WHERE request_key = $1", [
        `request-${suffix}`,
      ]);
      await executor.run("DELETE FROM notification_templates WHERE code = $1", [
        `pg-email-${suffix}`,
      ]);
      await executor.run(
        "DELETE FROM user_preferences WHERE user_id IN (SELECT id FROM users WHERE username = $1)",
        [`email-${suffix}`],
      );
      await executor.run("DELETE FROM users WHERE username = $1", [`email-${suffix}`]);
      await executor.close();
    }
  });
});

function requirePostgresqlUrl(): string {
  if (!postgresqlUrl) throw new Error("TEST_DATABASE_URL is required.");
  return postgresqlUrl;
}
