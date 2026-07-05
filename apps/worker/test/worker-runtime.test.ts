import { describe, expect, it } from "vitest";

import {
  createInMemoryJobSchedulerAdapter,
  createInMemoryQueueAdapter,
} from "@web-admin-base/adapters";
import { inAppNotificationDispatchJobType } from "@web-admin-base/contracts";
import { createWorkerRuntime } from "../src/runners/worker-runtime";
import { createInAppNotificationDispatchTask } from "../src/tasks/in-app-notification-dispatch";

describe("worker runtime", () => {
  it("uses the configured worker name", () => {
    const runtime = createWorkerRuntime({
      nodeEnv: "test",
      workerName: "test-worker",
    });

    expect(runtime.name).toBe("test-worker");
  });

  it("registers queue and scheduler tasks on start", async () => {
    const queue = createInMemoryQueueAdapter();
    const scheduler = createInMemoryJobSchedulerAdapter();
    const handledJobs: string[] = [];
    const logs: string[] = [];
    const runtime = createWorkerRuntime(
      {
        nodeEnv: "test",
        workerName: "test-worker",
      },
      {
        queue,
        scheduler,
        log: (message) => logs.push(message),
        queueTasks: [
          {
            jobType: "log.write",
            handler: async (job) => {
              handledJobs.push(job.id);
            },
          },
        ],
        scheduledTasks: [
          {
            definition: {
              code: "cleanup",
              cronExpression: "0 0 * * *",
              enabled: true,
            },
            handler: async () => undefined,
          },
        ],
      },
    );

    await runtime.start();
    const job = await queue.enqueue("log.write", { message: "ok" });
    await runtime.stop();

    expect(handledJobs).toEqual([job.id]);
    expect(logs).toEqual(["test-worker started", "test-worker stopped"]);
  });

  it("runs durable queue and scheduler processors", async () => {
    const runtime = createWorkerRuntime(
      {
        nodeEnv: "test",
        workerName: "durable-worker",
      },
      {
        durableQueue: {
          processReady: async () => 2,
        },
        durableScheduler: {
          processDue: async () => 1,
        },
        log: () => undefined,
      },
    );

    await expect(runtime.runOnce()).resolves.toEqual({ queueJobs: 2, scheduledJobs: 1 });
  });

  it("registers the in-app notification dispatch queue task", async () => {
    const queue = createInMemoryQueueAdapter();
    const handledTitles: string[] = [];
    const runtime = createWorkerRuntime(
      {
        nodeEnv: "test",
        workerName: "notification-worker",
      },
      {
        queue,
        log: () => undefined,
        queueTasks: [
          createInAppNotificationDispatchTask(async (payload) => {
            handledTitles.push(payload.title);
          }),
        ],
      },
    );

    await runtime.start();
    await queue.enqueue(inAppNotificationDispatchJobType, {
      recipientUserIds: ["1"],
      title: "System notice",
      body: "Body",
      metadata: {},
      createdBy: null,
      enqueuedAt: new Date().toISOString(),
    });
    await runtime.stop();

    expect(handledTitles).toEqual(["System notice"]);
  });
});
