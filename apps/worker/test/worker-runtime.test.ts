import { describe, expect, it } from "vitest";

import {
  createInMemoryJobSchedulerAdapter,
  createInMemoryQueueAdapter
} from "@web-admin-base/adapters";
import { createWorkerRuntime } from "../src/runners/worker-runtime";

describe("worker runtime", () => {
  it("uses the configured worker name", () => {
    const runtime = createWorkerRuntime({
      nodeEnv: "test",
      workerName: "test-worker"
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
        workerName: "test-worker"
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
            }
          }
        ],
        scheduledTasks: [
          {
            definition: {
              code: "cleanup",
              cronExpression: "0 0 * * *",
              enabled: true
            },
            handler: async () => undefined
          }
        ]
      }
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
        workerName: "durable-worker"
      },
      {
        durableQueue: {
          processReady: async () => 2
        },
        durableScheduler: {
          processDue: async () => 1
        },
        log: () => undefined
      }
    );

    await expect(runtime.runOnce()).resolves.toEqual({ queueJobs: 2, scheduledJobs: 1 });
  });
});
