import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  encryptWebhookSecret,
  jsonParam,
  type WebhookDeliveryConfig,
} from "@web-admin-base/adapters";
import { runSqliteMigrations } from "@web-admin-base/db";
import { afterEach, describe, expect, it } from "vitest";

import { createWorkerDatabaseExecutor } from "../src/infra/worker-database-executor";
import { createWebhookDeliveryProcessor } from "../src/webhooks/webhook-delivery.processor";
import { WebhookDeliveryRepository } from "../src/webhooks/webhook-delivery.repository";

const files: string[] = [];
const servers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  for (const file of files.splice(0)) if (existsSync(file)) rmSync(file, { force: true });
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

describe("durable webhook delivery", () => {
  it("fans out, signs, delivers, and persists an attempt", async () => {
    const bodies: string[] = [];
    const signatures: string[] = [];
    const server = createServer((request, response) => {
      signatures.push(String(request.headers["x-webhook-signature"]));
      request.on("data", (chunk) => bodies.push(chunk.toString()));
      request.on("end", () => {
        response.statusCode = 204;
        response.end();
      });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected server address.");

    const filename = join(tmpdir(), `webhook-worker-${process.pid}-${Date.now()}.sqlite`);
    files.push(filename);
    const url = `file:${filename}`;
    runSqliteMigrations({ url });
    const executor = createWorkerDatabaseExecutor({ dialect: "sqlite", url });
    const keyring = new Map([["test", randomBytes(32)]]);
    const config: WebhookDeliveryConfig = {
      enabled: true,
      eventSource: "test.admin",
      requestTimeoutMs: 1_000,
      maxAttempts: 5,
      concurrency: 4,
      retentionDays: 90,
      allowedHosts: new Set(),
      allowInsecureLocalhost: true,
      secretKeys: keyring,
      activeKeyId: "test",
    };
    try {
      const now = new Date().toISOString();
      await executor.run(
        `INSERT INTO webhook_subscriptions
         (name, url, event_types, secret, revision, status, is_deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, 'enabled', 0, ?, ?)`,
        [
          "test",
          `http://127.0.0.1:${address.port}/hook`,
          jsonParam(["user.created"], "sqlite"),
          encryptWebhookSecret("signing-secret", "test", keyring),
          now,
          now,
        ],
      );
      await executor.run(
        `INSERT INTO event_outbox
         (event_type, payload_json, status, attempt, max_attempts, occurred_at, created_at, updated_at)
         VALUES ('user.created', ?, 'pending', 0, 1, ?, ?, ?)`,
        [
          jsonParam(
            {
              subject: "users/42",
              occurredAt: now,
              data: { userId: "42", primaryOrganizationId: "1", createdByUserId: "1" },
            },
            "sqlite",
          ),
          now,
          now,
          now,
        ],
      );
      const repository = new WebhookDeliveryRepository(executor);
      const processor = createWebhookDeliveryProcessor({
        repository,
        config,
        workerId: "test-worker",
      });

      await expect(processor.fanOutPending()).resolves.toBe(1);
      await expect(processor.processReady()).resolves.toBe(1);

      const deliveries = await executor.all("SELECT status, attempt FROM webhook_deliveries");
      const attempts = await executor.all(
        "SELECT status, http_status FROM webhook_delivery_attempts",
      );
      expect(deliveries.map((row) => ({ ...row, attempt: Number(row.attempt) }))).toEqual([
        expect.objectContaining({ status: "succeeded", attempt: 1 }),
      ]);
      expect(attempts.map((row) => ({ ...row, http_status: Number(row.http_status) }))).toEqual([
        expect.objectContaining({ status: "succeeded", http_status: 204 }),
      ]);
      expect(signatures[0]).toMatch(/^v1=[a-f0-9]{64}$/);
      expect(JSON.parse(bodies.join(""))).toMatchObject({ id: "1", type: "user.created" });
    } finally {
      await executor.close();
    }
  });
});
