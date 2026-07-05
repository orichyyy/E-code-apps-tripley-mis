import type { HealthCheckableAdapter } from "../health";

export type DomainEvent<TPayload = unknown> = {
  id: string;
  type: string;
  payload: TPayload;
  occurredAt: string;
};

export type EventBusAdapter = HealthCheckableAdapter & {
  publish: <TPayload>(event: DomainEvent<TPayload>) => Promise<void>;
  subscribe: <TPayload>(
    eventType: string,
    handler: (event: DomainEvent<TPayload>) => Promise<void>,
  ) => Promise<void>;
};

export * from "./in-process-event-bus";
export * from "./database-event-bus";
