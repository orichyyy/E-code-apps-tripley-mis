import { serve } from "@hono/node-server";

import { createApp, createDatabaseBackedAppDependencies, createDefaultAppDependencies } from "./app";
import { loadApiConfig } from "./config/load-config";

const config = loadApiConfig();
const dependencies = process.env.BACKEND_CORE_STORE === "database"
  ? await createDatabaseBackedAppDependencies(config)
  : createDefaultAppDependencies(config);
const app = createApp(dependencies);

serve(
  {
    fetch: app.fetch,
    port: config.port
  },
  (info) => {
    console.log(`API server listening on http://localhost:${info.port}`);
  }
);
