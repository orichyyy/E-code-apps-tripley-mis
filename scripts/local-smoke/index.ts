import { apiPort, webPort } from "./config";
import { runAuthenticatedChecks, runBrowserSmoke, waitForHttp } from "./checks";
import { cleanupDefaultSmokeArtifacts, prepareSmokeWorkspace, runPnpm, startService, stopServices } from "./processes";

try {
  await prepareSmokeWorkspace();
  await runPnpm(["db:migrate:sqlite"], "db:migrate:sqlite");
  await runPnpm(["seed"], "seed");

  startService("api", ["dev:api"]);
  startService("web", ["dev:web"]);
  startService("worker", ["dev:worker"]);

  await waitForHttp(`http://localhost:${apiPort}/api/health`, "API health");
  await waitForHttp(`http://localhost:${webPort}`, "Vite web");
  await runAuthenticatedChecks();
  await runBrowserSmoke();

  console.log("Local smoke passed.");
} finally {
  await stopServices();
  if (!process.env.SMOKE_KEEP_DATA) {
    await cleanupDefaultSmokeArtifacts();
  }
}
