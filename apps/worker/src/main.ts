import { loadWorkerConfig } from "./config/load-config";
import { createWorkerRuntime } from "./runners/worker-runtime";

const runtime = createWorkerRuntime(loadWorkerConfig());

await runtime.start();

process.once("SIGINT", async () => {
  await runtime.stop();
  process.exit(0);
});

process.once("SIGTERM", async () => {
  await runtime.stop();
  process.exit(0);
});
