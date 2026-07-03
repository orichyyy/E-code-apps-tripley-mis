import type { HealthCheckableAdapter } from "../health";

export type ScheduledJobDefinition = {
  code: string;
  cronExpression: string;
  enabled: boolean;
};

export type JobSchedulerAdapter = HealthCheckableAdapter & {
  register: (job: ScheduledJobDefinition, handler: () => Promise<void>) => Promise<void>;
  unregister: (jobCode: string) => Promise<void>;
};

export * from "./in-memory-scheduler";
