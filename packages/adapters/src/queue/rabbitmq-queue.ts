import { randomUUID } from "node:crypto";

import type { Channel, ConsumeMessage } from "amqplib";

import type { QueueAdapter, QueueJob } from ".";
import {
  createRabbitMqConnection,
  decodePayload,
  encodePayload,
  type RabbitMqConnection,
  type RabbitMqConnectionOptions,
} from "../rabbitmq/connection";

export type RabbitMqQueueAdapter = QueueAdapter & {
  close: () => Promise<void>;
};

export type RabbitMqQueueAdapterOptions = RabbitMqConnectionOptions & {
  queuePrefix?: string;
};

type Handler = (job: QueueJob) => Promise<void>;

export async function createRabbitMqQueueAdapter(
  options: RabbitMqQueueAdapterOptions,
): Promise<RabbitMqQueueAdapter> {
  const connection = await createRabbitMqConnection({
    url: options.url,
    prefetch: options.prefetch ?? 10,
  });
  return createRabbitMqQueueAdapterFromConnection(connection, {
    queuePrefix: options.queuePrefix,
  });
}

export function createRabbitMqQueueAdapterFromConnection(
  connection: RabbitMqConnection,
  options: { queuePrefix?: string } = {},
): RabbitMqQueueAdapter {
  const queuePrefix = options.queuePrefix ?? "web-admin-base.queue";
  const handlers = new Map<string, Handler>();

  return {
    async enqueue<TPayload>(type: string, payload: TPayload): Promise<QueueJob<TPayload>> {
      const job = {
        id: randomUUID(),
        type,
        payload,
      };
      const queue = queueName(queuePrefix, type);
      await connection.channel.assertQueue(queue, { durable: true });
      connection.channel.sendToQueue(queue, encodePayload(job), {
        contentType: "application/json",
        deliveryMode: 2,
        messageId: job.id,
        type,
      });
      return job;
    },
    async consume(type, handler) {
      handlers.set(type, handler as Handler);
      const queue = queueName(queuePrefix, type);
      await connection.channel.assertQueue(queue, { durable: true });
      await connection.channel.consume(queue, (message) => {
        if (!message) return;
        void handleMessage(connection.channel, message, handlers.get(type));
      });
    },
    async healthCheck() {
      await connection.channel.assertQueue(queueName(queuePrefix, "__health__"), {
        durable: false,
        autoDelete: true,
        exclusive: true,
      });
      return { ok: true };
    },
    async close() {
      await connection.close();
    },
  };
}

async function handleMessage(
  channel: Channel,
  message: ConsumeMessage,
  handler: Handler | undefined,
): Promise<void> {
  try {
    if (!handler) {
      channel.nack(message, false, false);
      return;
    }
    await handler(decodePayload<QueueJob>(message.content));
    channel.ack(message);
  } catch {
    channel.nack(message, false, false);
  }
}

function queueName(prefix: string, type: string): string {
  return `${prefix}.${type}`;
}
