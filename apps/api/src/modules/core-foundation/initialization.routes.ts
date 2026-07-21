import { initializationSetupRequestSchema } from "@web-admin-base/contracts";
import type { Context } from "hono";
import { Hono } from "hono";

import type { BackendCoreServices } from "./services";

export function createInitializationRoutes(
  services: BackendCoreServices,
  afterInitialize?: (initializedBy: string | null) => Promise<void>,
  beforeInitialize?: () => Promise<void>,
) {
  const routes = new Hono();

  const statusHandler = (context: Context) => {
    return context.json({ data: services.getInitializationStatus() });
  };

  const setupHandler = async (context: Context) => {
    const input = initializationSetupRequestSchema.parse(await context.req.json());
    await beforeInitialize?.();
    const result = await services.initialize(input);
    await afterInitialize?.(result.admin?.id ?? null);
    return context.json({ data: result }, 201);
  };

  routes.get("/initialization/status", statusHandler);
  routes.post("/initialization/setup", setupHandler);
  routes.get("/setup/status", statusHandler);
  routes.post("/setup/initialize", setupHandler);

  return routes;
}
