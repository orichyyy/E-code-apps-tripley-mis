import { createConfiguredWorkerApplication } from "./bootstrap";
import { loadWorkerConfig } from "./config/load-config";

const application = await createConfiguredWorkerApplication(loadWorkerConfig());

await application.runtime.start();

process.once("SIGINT", async () => {
  await application.close();
  process.exit(0);
});

process.once("SIGTERM", async () => {
  await application.close();
  process.exit(0);
});
