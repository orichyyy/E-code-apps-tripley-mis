import { randomUUID } from "node:crypto";

import type { Channel, ConsumeMessage } from "amqplib";

import type { DomainEvent, EventBusAdapter } from ".";
import {
  createRabbitMqConnection,
  decodePayload,
  encodePayload,
  type RabbitMqConnection,
  type RabbitMqConnectionOptions,
} from "../rabbitmq/connection";

export type RabbitMqEventBusAdapter = EventBusAdapter & {
  close: () => Promise<void>;
};

export type RabbitMqEventBusAdapterOptions = RabbitMqConnectionOptions & {
  exchange?: string;
  queuePrefix?: string;
};

type Handler = (event: DomainEvent) => Promise<void>;

export async function createRabbitMqEventBusAdapter(
  options: RabbitMqEventBusAdapterOptions,
): Promise<RabbitMqEventBusAdapter> {
  const connection = await createRabbitMqConnection({
    url: options.url,
    prefetch: options.prefetch ?? 10,
  });
  return createRabbitMqEventBusAdapterFromConnection(connection, {
    exchange: options.exchange,
    queuePrefix: options.queuePrefix,
  });
}

export function createRabbitMqEventBusAdapterFromConnection(
  connection: RabbitMqConnection,
  options: { exchange?: string; queuePrefix?: string } = {},
): RabbitMqEventBusAdapter {
  const exchange = options.exchange ?? "web-admin-base.events";
  const queuePrefix = options.queuePrefix ?? "web-admin-base.events";

  return {
    async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
      await connection.channel.assertExchange(exchange, "topic", { durable: true });
      connection.channel.publish(exchange, event.type, encodePayload(event), {
        contentType: "application/json",
        deliveryMode: 2,
        messageId: event.id,
        type: event.type,
        timestamp: Math.floor(Date.parse(event.occurredAt) / 1000),
      });
    },
    async subscribe(eventType, handler) {
      await connection.channel.assertExchange(exchange, "topic", { durable: true });
      const queue = `${queuePrefix}.${eventType}.${randomUUID()}`;
      await connection.channel.assertQueue(queue, {
        durable: false,
        autoDelete: true,
        exclusive: true,
      });
      await connection.channel.bindQueue(queue, exchange, eventType);
      await connection.channel.consume(queue, (message) => {
        if (!message) return;
        void handleMessage(connection.channel, message, handler as Handler);
      });
    },
    async healthCheck() {
      await connection.channel.assertExchange(exchange, "topic", { durable: true });
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
  handler: Handler,
): Promise<void> {
  try {
    await handler(decodePayload<DomainEvent>(message.content));
    channel.ack(message);
  } catch {
    channel.nack(message, false, false);
  }
}
