import { describe, expect, it } from "vitest";

import {
  createInMemoryJobSchedulerAdapter,
  createInMemoryLockAdapter,
  createInMemoryNotificationChannelAdapter,
  createInMemoryQueueAdapter,
  createInMemoryRateLimitAdapter,
  createInProcessEventBusAdapter,
} from "../src";

describe("in-memory infrastructure adapters", () => {
  it("acquires and releases locks", async () => {
    const locks = createInMemoryLockAdapter();
    const first = await locks.acquire("job");
    const blocked = await locks.acquire("job");

    await first?.release();
    const second = await locks.acquire("job");

    expect(first?.key).toBe("job");
    expect(blocked).toBeNull();
    expect(second?.key).toBe("job");
  });

  it("dispatches queue jobs and events", async () => {
    const queue = createInMemoryQueueAdapter();
    const eventBus = createInProcessEventBusAdapter();
    const handledJobs: string[] = [];
    const handledEvents: string[] = [];

    await queue.consume("export", async (job) => {
      handledJobs.push(job.id);
    });
    await eventBus.subscribe("user.created", async (event) => {
      handledEvents.push(event.id);
    });
    const job = await queue.enqueue("export", { resource: "logs" });
    await eventBus.publish({
      id: "event-1",
      type: "user.created",
      payload: { id: "1" },
      occurredAt: "2026-07-03T00:00:00.000Z",
    });

    expect(handledJobs).toEqual([job.id]);
    expect(handledEvents).toEqual(["event-1"]);
  });

  it("tracks rate limits inside the configured window", async () => {
    const rateLimit = createInMemoryRateLimitAdapter();

    await expect(rateLimit.check("login:1", 2, 60)).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });
    await expect(rateLimit.check("login:1", 2, 60)).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
    await expect(rateLimit.check("login:1", 2, 60)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it("stores scheduled jobs and notification messages through adapter boundaries", async () => {
    const scheduler = createInMemoryJobSchedulerAdapter();
    const notifications = createInMemoryNotificationChannelAdapter();

    await scheduler.register(
      { code: "cleanup", cronExpression: "0 0 * * *", enabled: true },
      async () => undefined,
    );
    await notifications.send({
      channel: "webhook",
      recipient: "https://example.test/hook",
      body: "payload",
    });

    await expect(scheduler.healthCheck()).resolves.toEqual({ ok: true });
    expect(notifications.listMessages()).toEqual([
      expect.objectContaining({ channel: "webhook", body: "payload" }),
    ]);
  });
});
