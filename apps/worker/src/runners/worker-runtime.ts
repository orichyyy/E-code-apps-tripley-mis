import type { WorkerConfig } from "../config/load-config";

export type WorkerRuntime = {
  readonly name: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export function createWorkerRuntime(config: WorkerConfig): WorkerRuntime {
  return {
    name: config.workerName,
    async start() {
      console.log(`${config.workerName} started`);
    },
    async stop() {
      console.log(`${config.workerName} stopped`);
    }
  };
}
