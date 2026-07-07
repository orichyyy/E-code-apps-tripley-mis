import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createRabbitMqEventBusAdapter, createRabbitMqQueueAdapter } from "../src";

const rabbitMqUrl = process.env.RABBITMQ_URL;

describe.runIf(rabbitMqUrl)("RabbitMQ infrastructure adapters", () => {
  it("dispatches queue jobs and domain events", async () => {
    const prefix = `web-admin-base.test.${randomUUID()}`;
    const queue = await createRabbitMqQueueAdapter({
      url: getRabbitMqUrl(),
      queuePrefix: `${prefix}.queue`,
      prefetch: 1,
    });
    const eventBus = await createRabbitMqEventBusAdapter({
      url: getRabbitMqUrl(),
      exchange: `${prefix}.events`,
      queuePrefix: `${prefix}.events`,
      prefetch: 1,
    });
    const handledJobs: string[] = [];
    const handledEvents: string[] = [];

    try {
      await queue.consume("log.write", async (job) => {
        handledJobs.push((job.payload as { message: string }).message);
      });
      await eventBus.subscribe("user.created", async (event) => {
        handledEvents.push((event.payload as { username: string }).username);
      });

      await queue.enqueue("log.write", { message: "created" });
      await eventBus.publish({
        id: randomUUID(),
        type: "user.created",
        payload: { username: "admin" },
        occurredAt: new Date().toISOString(),
      });

      await waitFor(() => handledJobs.length === 1 && handledEvents.length === 1);

      expect(handledJobs).toEqual(["created"]);
      expect(handledEvents).toEqual(["admin"]);
      await expect(queue.healthCheck()).resolves.toEqual({ ok: true });
      await expect(eventBus.healthCheck()).resolves.toEqual({ ok: true });
    } finally {
      await eventBus.close();
      await queue.close();
    }
  });
});

async function waitFor(assertion: () => boolean): Promise<void> {
  const expiresAt = Date.now() + 5_000;
  while (Date.now() < expiresAt) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for RabbitMQ message dispatch.");
}

function getRabbitMqUrl(): string {
  if (!rabbitMqUrl) throw new Error("RABBITMQ_URL is required for RabbitMQ integration tests.");
  return rabbitMqUrl;
}
