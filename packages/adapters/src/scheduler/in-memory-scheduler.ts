import type { JobSchedulerAdapter, ScheduledJobDefinition } from ".";

export function createInMemoryJobSchedulerAdapter(): JobSchedulerAdapter {
  const jobs = new Map<
    string,
    { definition: ScheduledJobDefinition; handler: () => Promise<void> }
  >();

  return {
    async healthCheck() {
      return { ok: true };
    },
    async register(job, handler) {
      jobs.set(job.code, { definition: { ...job }, handler });
    },
    async unregister(jobCode) {
      jobs.delete(jobCode);
    },
  };
}
