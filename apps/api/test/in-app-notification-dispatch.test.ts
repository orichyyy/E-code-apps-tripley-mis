import {
  createDatabaseQueueAdapter,
  createInMemoryQueueAdapter,
  type DatabaseAdapterExecutor,
} from "@web-admin-base/adapters";
import { inAppNotificationDispatchPayloadSchema } from "@web-admin-base/contracts";
import { runPostgresqlMigrations } from "@web-admin-base/db";
import { describe, expect, it } from "vitest";

import { createPostgresqlInfrastructureExecutor } from "../src/modules/infrastructure/infrastructure.executor";
import { InfrastructureRepository } from "../src/modules/infrastructure/infrastructure.repository";
import { InfrastructureServices } from "../src/modules/infrastructure/infrastructure.service";

const postgresqlUrl = process.env.TEST_DATABASE_URL;

describe("in-app notification dispatch", () => {
  it("fans out rendered in-app notifications through the queue", async () => {
    const queue = createInMemoryQueueAdapter();
    const services = InfrastructureServices.inMemory({
      queue,
      organizationUserResolver: async (organizationId) =>
        organizationId === "org-1" ? ["10", "10", "11"] : [],
    });
    await queue.consume("notification.in_app.dispatch", async (job) => {
      await services.dispatchInAppNotificationJob(
        inAppNotificationDispatchPayloadSchema.parse(job.payload),
      );
    });
    await services.createNotificationTemplate({
      code: "task-ready",
      channel: "in_app",
      locale: "en",
      subject: "Task {taskName}",
      body: "Task {{taskName}} is ready for {userName}.",
      variables: ["taskName", "userName"],
    });

    const result = await services.enqueueInAppNotification({
      templateCode: "task-ready",
      locale: "en",
      audience: { type: "organization", organizationId: "org-1" },
      variables: { taskName: "Review", userName: "Ada" },
      metadata: { source: "test" },
      createdBy: "1",
    });

    expect(result).toEqual({
      jobId: "1",
      jobType: "notification.in_app.dispatch",
      recipientCount: 2,
    });
    await expect(services.listNotifications("10")).resolves.toEqual([
      expect.objectContaining({
        userId: "10",
        channel: "in_app",
        title: "Task Review",
        body: "Task Review is ready for Ada.",
        status: "unread",
      }),
    ]);
    await expect(services.listNotifications("11")).resolves.toEqual([
      expect.objectContaining({
        userId: "11",
        title: "Task Review",
      }),
    ]);
  });

  it("requires an in-app template subject for notification titles", async () => {
    const services = InfrastructureServices.inMemory();
    await services.createNotificationTemplate({
      code: "missing-title",
      channel: "in_app",
      locale: "en",
      body: "Body",
      variables: [],
    });

    await expect(
      services.enqueueInAppNotification({
        templateCode: "missing-title",
        locale: "en",
        audience: { type: "users", userIds: ["1"] },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_INVALID_REQUEST" });
  });

  it.runIf(postgresqlUrl)(
    "persists queued dispatch jobs and notification records in PostgreSQL",
    async () => {
      const url = getPostgresqlUrl();
      await runPostgresqlMigrations({ url });
      const executor = createPostgresqlInfrastructureExecutor(url);
      const queue = createDatabaseQueueAdapter(executor, { workerId: "notification-test-worker" });
      const services = InfrastructureServices.database(new InfrastructureRepository(executor), {
        queue,
      });

      try {
        await clearTables(executor);
        await services.createNotificationTemplate({
          code: "db-notice",
          channel: "in_app",
          locale: "en",
          subject: "Notice {name}",
          body: "Hello {name}",
          variables: ["name"],
        });
        await queue.consume("notification.in_app.dispatch", async (job) => {
          await services.dispatchInAppNotificationJob(
            inAppNotificationDispatchPayloadSchema.parse(job.payload),
          );
        });

        const enqueueResult = await services.enqueueInAppNotification({
          templateCode: "db-notice",
          locale: "en",
          audience: { type: "users", userIds: ["101", "101", "102"] },
          variables: { name: "Ada" },
          createdBy: "1",
        });
        const pendingRows = await executor.all(
          "SELECT type, status FROM queue_jobs ORDER BY id ASC",
        );
        const processed = await queue.processReady();
        const succeededRows = await executor.all(
          "SELECT type, status FROM queue_jobs ORDER BY id ASC",
        );

        expect(enqueueResult.recipientCount).toBe(2);
        expect(pendingRows).toEqual([
          expect.objectContaining({ type: "notification.in_app.dispatch", status: "pending" }),
        ]);
        expect(processed).toBe(1);
        expect(succeededRows).toEqual([
          expect.objectContaining({ type: "notification.in_app.dispatch", status: "succeeded" }),
        ]);
        await expect(services.listNotifications("101")).resolves.toEqual([
          expect.objectContaining({
            userId: "101",
            title: "Notice Ada",
            body: "Hello Ada",
            status: "unread",
          }),
        ]);
      } finally {
        await clearTables(executor);
        await services.close();
      }
    },
  );
});

async function clearTables(executor: DatabaseAdapterExecutor): Promise<void> {
  for (const table of ["notifications", "notification_templates", "queue_jobs"]) {
    await executor.run(`DELETE FROM ${table}`);
  }
}

function getPostgresqlUrl(): string {
  if (!postgresqlUrl)
    throw new Error("TEST_DATABASE_URL is required for PostgreSQL notification tests.");
  return postgresqlUrl;
}
