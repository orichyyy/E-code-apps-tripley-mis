import { Hono } from "hono";

import type { BackendCoreServices } from "./services";

export function createRouteMetadataRoutes(services: BackendCoreServices) {
  const routes = new Hono();

  routes.get("/routes/manifest", (context) => {
    return context.json({ data: services.listRoutes() });
  });

  routes.post("/routes/sync", async (context) => {
    return context.json({ data: await services.syncRoutes() });
  });

  return routes;
}
