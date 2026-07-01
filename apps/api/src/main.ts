import { serve } from "@hono/node-server";

import { createApp } from "./app";
import { loadApiConfig } from "./config/load-config";

const config = loadApiConfig();
const app = createApp();

serve(
  {
    fetch: app.fetch,
    port: config.port
  },
  (info) => {
    console.log(`API server listening on http://localhost:${info.port}`);
  }
);
