import type { HealthCheckableAdapter } from "../health";

export type QueueJob<TPayload = unknown> = {
  id: string;
  type: string;
  payload: TPayload;
};

export type QueueAdapter = HealthCheckableAdapter & {
  enqueue: <TPayload>(type: string, payload: TPayload) => Promise<QueueJob<TPayload>>;
  consume: <TPayload>(
    type: string,
    handler: (job: QueueJob<TPayload>) => Promise<void>
  ) => Promise<void>;
};

export * from "./in-memory-queue";
