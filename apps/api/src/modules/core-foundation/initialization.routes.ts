import { initializationSetupRequestSchema } from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { BackendCoreServices } from "./services";

export function createInitializationRoutes(services: BackendCoreServices) {
  const routes = new Hono();

  routes.get("/initialization/status", (context) => {
    return context.json({ data: services.getInitializationStatus() });
  });

  routes.post("/initialization/setup", async (context) => {
    const input = initializationSetupRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.initialize(input) }, 201);
  });

  return routes;
}
