import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runSqliteMigrations } from "@web-admin-base/db";
import { afterEach, describe, expect, it } from "vitest";

import {
  parseEmailDeliveryRequestArgs,
  runEmailDeliveryRequestCli,
} from "../src/email-delivery-request";
import { createSqliteInfrastructureExecutor } from "../src/modules/infrastructure/infrastructure.executor";

let filename: string | null = null;

afterEach(() => {
  if (filename && existsSync(filename)) rmSync(filename, { force: true });
  filename = null;
});

describe("email delivery request CLI", () => {
  it("requires the documented request arguments", () => {
    expect(() => parseEmailDeliveryRequestArgs([])).toThrow();
  });

  it("rejects production execution before opening a database", async () => {
    await expect(
      runEmailDeliveryRequestCli({
        args: [],
        env: { NODE_ENV: "production", DATABASE_URL: "invalid" },
        output: () => undefined,
      }),
    ).rejects.toThrow("disabled in production");
  });

  it("returns the existing delivery for an idempotent repeated request", async () => {
    filename = join(tmpdir(), `email-request-cli-${process.pid}-${Date.now()}.sqlite`);
    const url = `file:${filename}`;
    runSqliteMigrations({ url });
    await seedCliRecipient(url);
    const outputs: string[] = [];
    const options = {
      args: [
        "--request-key",
        "cli-request-1",
        "--user-id",
        "1",
        "--template-code",
        "cli.notice",
        "--variables",
        '{"name":"Ada"}',
      ],
      env: {
        NODE_ENV: "test",
        DATABASE_DIALECT: "sqlite",
        DATABASE_URL: url,
        EMAIL_DELIVERY_ENABLED: "true",
        EMAIL_CONTENT_KEYS: JSON.stringify({ primary: Buffer.alloc(32, 4).toString("base64") }),
        EMAIL_CONTENT_ACTIVE_KEY_ID: "primary",
      },
      output: (value: string) => outputs.push(value),
    };

    await runEmailDeliveryRequestCli(options);
    await runEmailDeliveryRequestCli(options);

    const parsed = outputs.map((value) => JSON.parse(value) as { id: string; status: string });
    expect(parsed).toHaveLength(2);
    expect(parsed[1]).toEqual(parsed[0]);
    expect(parsed[0]?.status).toBe("pending");
  });
});

async function seedCliRecipient(url: string): Promise<void> {
  const executor = createSqliteInfrastructureExecutor(url);
  const now = new Date().toISOString();
  try {
    await executor.run(
      `INSERT INTO users
       (username, display_name, email, phone, password_hash, status,
        first_login_password_change_required, failed_login_attempts, token_version,
        is_deleted, created_at, updated_at)
       VALUES ('cli-user', 'CLI User', 'cli@example.com', '10001', 'hash',
        'enabled', 0, 0, 0, 0, ?, ?)`,
      [now, now],
    );
    await executor.run(
      `INSERT INTO notification_templates
       (code, channel, locale, subject, body, variables_json, status, created_at, updated_at)
       VALUES ('cli.notice', 'email', 'en', 'Hello {{name}}', 'Body {{name}}',
        '["name"]', 'enabled', ?, ?)`,
      [now, now],
    );
  } finally {
    await executor.close();
  }
}
