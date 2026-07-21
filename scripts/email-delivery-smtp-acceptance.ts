import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  createSmtpNotificationChannelAdapter,
  loadEmailDeliveryConfig,
  loadSmtpRuntimeConfig,
} from "../packages/adapters/src/index";
import { runPostgresqlMigrations } from "../packages/db/src/index";

import { createApp } from "../apps/api/src/app";
import { createInMemoryBackendCoreServices } from "../apps/api/src/modules/core-foundation/services";
import { EmailDeliveryRepository } from "../apps/api/src/modules/infrastructure/email-delivery.repository";
import { EmailDeliveryService } from "../apps/api/src/modules/infrastructure/email-delivery.service";
import { createPostgresqlInfrastructureExecutor } from "../apps/api/src/modules/infrastructure/infrastructure.executor";
import { InfrastructureRepository } from "../apps/api/src/modules/infrastructure/infrastructure.repository";
import { InfrastructureServices } from "../apps/api/src/modules/infrastructure/infrastructure.service";
import { createEmailDeliveryProcessor } from "../apps/worker/src/email/email-delivery.processor";
import { WorkerEmailDeliveryRepository } from "../apps/worker/src/email/email-delivery.repository";
import { createWorkerDatabaseExecutor } from "../apps/worker/src/infra/worker-database-executor";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is required for SMTP acceptance.");
await runPostgresqlMigrations({ url });

const apiExecutor = createPostgresqlInfrastructureExecutor(url);
const workerExecutor = createWorkerDatabaseExecutor({ dialect: "postgresql", url });
const queryExecutor = createPostgresqlInfrastructureExecutor(url);
const suffix = randomUUID();
const requestKey = `smtp-acceptance-${suffix}`;
const templateCode = `smtp.acceptance.${suffix}`;
const username = `smtp-${suffix}`;
const subject = `Reliable SMTP ${suffix}`;
try {
  const now = new Date().toISOString();
  await apiExecutor.run(
    `INSERT INTO users
     (username, display_name, email, phone, password_hash, status,
      first_login_password_change_required, failed_login_attempts, token_version,
      is_deleted, created_at, updated_at)
     VALUES ($1, 'SMTP Acceptance', $2, $3, 'hash', 'enabled', FALSE, 0, 0, FALSE, $4, $5)`,
    [username, `${suffix}@example.com`, suffix, now, now],
  );
  const users = await apiExecutor.all("SELECT id FROM users WHERE username = $1", [username]);
  const userId = String(users[0]?.id);
  await apiExecutor.run(
    `INSERT INTO user_preferences
     (user_id, language, theme_mode, theme_color, page_tabs_enabled, updated_at)
     VALUES ($1, 'en', 'light', 'blue', TRUE, $2)`,
    [userId, now],
  );
  await apiExecutor.run(
    `INSERT INTO notification_templates
     (code, channel, locale, subject, body, variables_json, status, created_at, updated_at)
     VALUES ($1, 'email', 'en', $2, 'Acceptance body {{name}}', $3, 'enabled', $4, $5)`,
    [templateCode, subject, JSON.stringify(["name"]), now, now],
  );
  const contentKey = Buffer.alloc(32, 8).toString("base64");
  const deliveryConfig = loadEmailDeliveryConfig({
    EMAIL_DELIVERY_ENABLED: "true",
    EMAIL_CONTENT_KEYS: JSON.stringify({ acceptance: contentKey }),
    EMAIL_CONTENT_ACTIVE_KEY_ID: "acceptance",
  });
  const smtp = loadSmtpRuntimeConfig({
    SMTP_ENABLED: "true",
    SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
    SMTP_PORT: process.env.SMTP_PORT ?? "1025",
    SMTP_FROM: "sender@example.com",
    SMTP_TIMEOUT_MS: "5000",
  });
  assert(smtp.host && smtp.from);
  const service = new EmailDeliveryService(
    new EmailDeliveryRepository(apiExecutor),
    deliveryConfig,
  );
  const delivery = await service.request({
    requestKey,
    userId,
    templateCode,
    variables: { name: "Ada" },
  });
  const processor = createEmailDeliveryProcessor({
    repository: new WorkerEmailDeliveryRepository(workerExecutor),
    config: deliveryConfig,
    smtp,
    channel: createSmtpNotificationChannelAdapter({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      from: smtp.from,
      timeoutMs: smtp.timeoutMs,
    }),
    workerId: "smtp-acceptance-worker",
  });

  assert.equal(await processor.processReady(), 1);
  const infrastructureServices = InfrastructureServices.database(
    new InfrastructureRepository(queryExecutor),
    { emailDeliveryConfig: deliveryConfig },
  );
  const app = createApp({
    backendCoreServices: createInMemoryBackendCoreServices(),
    infrastructureServices,
  });
  const authorization = await initializeAndLogin(app);
  const detailResponse = await app.request(`/api/email-deliveries/${delivery.id}`, {
    headers: { authorization },
  });
  assert.equal(detailResponse.status, 200);
  const detailEnvelope = (await detailResponse.json()) as {
    data: Awaited<ReturnType<typeof service.get>>;
  };
  const detail = detailEnvelope.data;
  assert.equal(detail?.status, "succeeded");
  assert.equal(detail?.attempts.length, 1);
  assert(detail?.contentPurgedAt);
  assert(!JSON.stringify(detail).includes(`${suffix}@example.com`));
  await waitForMailpitSubject(subject);
  console.log(`Reliable email SMTP acceptance passed for delivery ${delivery.id}.`);
} finally {
  await apiExecutor.run(
    `DELETE FROM email_delivery_attempts WHERE delivery_id IN
     (SELECT id FROM email_deliveries WHERE request_key = $1)`,
    [requestKey],
  );
  await apiExecutor.run("DELETE FROM email_deliveries WHERE request_key = $1", [requestKey]);
  await apiExecutor.run("DELETE FROM notification_templates WHERE code = $1", [templateCode]);
  await apiExecutor.run(
    "DELETE FROM user_preferences WHERE user_id IN (SELECT id FROM users WHERE username = $1)",
    [username],
  );
  await apiExecutor.run("DELETE FROM users WHERE username = $1", [username]);
  await Promise.all([apiExecutor.close(), workerExecutor.close(), queryExecutor.close()]);
}

async function initializeAndLogin(app: ReturnType<typeof createApp>): Promise<string> {
  const initialization = await app.request("/api/initialization/setup", {
    method: "POST",
    body: JSON.stringify({
      organizationName: "SMTP Acceptance",
      organizationCode: "smtp-acceptance",
      adminUsername: "smtp-admin",
      adminDisplayName: "SMTP Admin",
      adminEmail: "smtp-admin@example.com",
      adminPhone: "10000000000",
      adminPassword: "password1",
    }),
  });
  assert.equal(initialization.status, 201);
  const login = await app.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "smtp-admin", password: "password1" }),
  });
  assert.equal(login.status, 200);
  const payload = (await login.json()) as { data: { accessToken: string } };
  return `Bearer ${payload.data.accessToken}`;
}

async function waitForMailpitSubject(expected: string): Promise<void> {
  const baseUrl = process.env.MAILPIT_API_URL ?? "http://127.0.0.1:8025";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/v1/messages`);
    const payload = (await response.json()) as { messages?: Array<{ Subject?: string }> };
    if (payload.messages?.some((message) => message.Subject === expected)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Mailpit did not receive the reliable email acceptance message.");
}
