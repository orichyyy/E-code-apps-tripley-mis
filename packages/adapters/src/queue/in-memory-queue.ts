import type { QueueAdapter, QueueJob } from ".";

type Handler = (job: QueueJob<unknown>) => Promise<void>;

export function createInMemoryQueueAdapter(): QueueAdapter {
  const handlers = new Map<string, Handler[]>();
  let nextId = 0;

  return {
    async healthCheck() {
      return { ok: true };
    },
    async enqueue(type, payload) {
      const job = {
        id: (++nextId).toString(),
        type,
        payload
      };
      for (const handler of handlers.get(type) ?? []) {
        await handler(job);
      }
      return job;
    },
    async consume(type, handler) {
      const existing = handlers.get(type) ?? [];
      existing.push(handler as Handler);
      handlers.set(type, existing);
    }
  };
}
