import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { EmailDeliveryConfig } from "@web-admin-base/adapters";
import { runSqliteMigrations } from "@web-admin-base/db";
import { afterEach, describe, expect, it } from "vitest";

import { createSqliteInfrastructureExecutor } from "../src/modules/infrastructure/infrastructure.executor";
import { EmailDeliveryRepository } from "../src/modules/infrastructure/email-delivery.repository";
import { EmailDeliveryService } from "../src/modules/infrastructure/email-delivery.service";

let cleanup: (() => Promise<void>) | null = null;

afterEach(async () => {
  await cleanup?.();
  cleanup = null;
});

describe("internal email notification request service", () => {
  it("snapshots an eligible recipient and handles idempotent requests", async () => {
    const { executor, close } = createDatabase();
    cleanup = close;
    await seedRecipientAndTemplate(executor);
    const service = new EmailDeliveryService(
      new EmailDeliveryRepository(executor),
      deliveryConfig(),
    );
    const input = {
      requestKey: "test-request-1",
      userId: "1",
      templateCode: "welcome",
      variables: { name: "Ada" },
    };

    const first = await service.request(input);
    const second = await service.request(input);
    const list = await service.list({ page: 1, pageSize: 20 });

    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({
      userId: "1",
      locale: "zh",
      maskedRecipient: "a***e@example.com",
      status: "pending",
    });
    expect(list.items).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain("Hello Ada");
    expect(JSON.stringify(list)).not.toContain("alice@example.com");
  });

  it("rejects semantic reuse of a request key", async () => {
    const { executor, close } = createDatabase();
    cleanup = close;
    await seedRecipientAndTemplate(executor);
    const service = new EmailDeliveryService(
      new EmailDeliveryRepository(executor),
      deliveryConfig(),
    );
    await service.request({
      requestKey: "same-key",
      userId: "1",
      templateCode: "welcome",
      variables: { name: "Ada" },
    });

    await expect(
      service.request({
        requestKey: "same-key",
        userId: "1",
        templateCode: "welcome",
        variables: { name: "Grace" },
      }),
    ).rejects.toMatchObject({ code: "BUSINESS_EMAIL_IDEMPOTENCY_CONFLICT" });
  });

  it("replays an accepted request while new reliable delivery requests are disabled", async () => {
    const { executor, close } = createDatabase();
    cleanup = close;
    await seedRecipientAndTemplate(executor);
    const repository = new EmailDeliveryRepository(executor);
    const input = {
      requestKey: "accepted-before-disable",
      userId: "1",
      templateCode: "welcome",
      variables: { name: "Ada" },
    };
    const accepted = await new EmailDeliveryService(repository, deliveryConfig()).request(input);
    const disabledConfig = { ...deliveryConfig(), enabled: false };

    await expect(
      new EmailDeliveryService(repository, disabledConfig).request(input),
    ).resolves.toMatchObject({
      id: accepted.id,
    });
    await expect(
      new EmailDeliveryService(repository, disabledConfig).request({
        ...input,
        requestKey: "new-after-disable",
      }),
    ).rejects.toMatchObject({ code: "BUSINESS_EMAIL_DELIVERY_DISABLED" });
  });
});

function createDatabase() {
  const filename = join(tmpdir(), `email-api-${process.pid}-${Date.now()}.sqlite`);
  const url = `file:${filename}`;
  runSqliteMigrations({ url });
  const executor = createSqliteInfrastructureExecutor(url);
  return {
    executor,
    async close() {
      await executor.close();
      if (existsSync(filename)) rmSync(filename, { force: true });
    },
  };
}

function deliveryConfig(): EmailDeliveryConfig {
  return {
    enabled: true,
    concurrency: 4,
    maxAttempts: 5,
    retentionDays: 90,
    staleSeconds: 900,
    contentKeys: new Map([["primary", Buffer.alloc(32, 5)]]),
    activeKeyId: "primary",
  };
}

async function seedRecipientAndTemplate(executor: {
  run(sql: string, params?: unknown[]): Promise<void>;
}) {
  const now = new Date().toISOString();
  await executor.run(
    `INSERT INTO users
     (username, display_name, email, phone, password_hash, status,
      first_login_password_change_required, failed_login_attempts, token_version,
      is_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'enabled', 0, 0, 0, 0, ?, ?)`,
    ["alice", "Alice", "alice@example.com", "10001", "hash", now, now],
  );
  await executor.run(
    `INSERT INTO user_preferences
     (user_id, language, theme_mode, theme_color, page_tabs_enabled, updated_at)
     VALUES (1, 'zh', 'light', 'blue', 1, ?)`,
    [now],
  );
  await executor.run(
    `INSERT INTO notification_templates
     (code, channel, locale, subject, body, variables_json, status, created_at, updated_at)
     VALUES ('welcome', 'email', 'zh', 'Hello {{name}}', 'Body for {{name}}',
      '["name"]', 'enabled', ?, ?)`,
    [now, now],
  );
}
