import type { DomainEvent, EventBusAdapter } from ".";

type Handler = (event: DomainEvent<unknown>) => Promise<void>;

export function createInProcessEventBusAdapter(): EventBusAdapter {
  const handlers = new Map<string, Handler[]>();

  return {
    async healthCheck() {
      return { ok: true };
    },
    async publish(event) {
      for (const handler of handlers.get(event.type) ?? []) {
        await handler(event);
      }
    },
    async subscribe(eventType, handler) {
      const existing = handlers.get(eventType) ?? [];
      existing.push(handler as Handler);
      handlers.set(eventType, existing);
    }
  };
}
