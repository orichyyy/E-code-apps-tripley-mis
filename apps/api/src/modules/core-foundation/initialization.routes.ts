import { initializationSetupRequestSchema } from "@web-admin-base/contracts";
import type { Context } from "hono";
import { Hono } from "hono";

import type { BackendCoreServices } from "./services";

export function createInitializationRoutes(services: BackendCoreServices) {
  const routes = new Hono();

  const statusHandler = (context: Context) => {
    return context.json({ data: services.getInitializationStatus() });
  };

  const setupHandler = async (context: Context) => {
    const input = initializationSetupRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.initialize(input) }, 201);
  };

  routes.get("/initialization/status", statusHandler);
  routes.post("/initialization/setup", setupHandler);
  routes.get("/setup/status", statusHandler);
  routes.post("/setup/initialize", setupHandler);

  return routes;
}
