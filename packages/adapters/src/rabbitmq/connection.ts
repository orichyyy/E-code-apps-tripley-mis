import type { Channel, ChannelModel } from "amqplib";

type AmqpModule = typeof import("amqplib");

export type RabbitMqConnectionOptions = {
  url: string;
  prefetch?: number;
};

export type RabbitMqConnection = {
  connection: ChannelModel;
  channel: Channel;
  close: () => Promise<void>;
};

export async function createRabbitMqConnection(
  options: RabbitMqConnectionOptions,
): Promise<RabbitMqConnection> {
  const amqp = (await import("amqplib")) as AmqpModule;
  const connection = await amqp.connect(options.url);
  const channel = await connection.createChannel();
  if (options.prefetch && options.prefetch > 0) {
    await channel.prefetch(options.prefetch);
  }
  return {
    connection,
    channel,
    async close() {
      await channel.close();
      await connection.close();
    },
  };
}

export function encodePayload(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value), "utf8");
}

export function decodePayload<T>(buffer: Buffer): T {
  return JSON.parse(buffer.toString("utf8")) as T;
}
