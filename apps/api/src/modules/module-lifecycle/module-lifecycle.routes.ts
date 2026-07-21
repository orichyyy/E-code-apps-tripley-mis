import { applyModuleSyncRequestSchema } from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import { assertEmptyJsonBody } from "../core-foundation/request-body";
import type { ModuleLifecycleService } from "./module-lifecycle.service";

type ModuleLifecycleBindings = {
  Variables: AuthContextVariables;
};

export function createModuleLifecycleRoutes(service: ModuleLifecycleService) {
  return new Hono<ModuleLifecycleBindings>()
    .get("/modules/registry", async (context) => {
      return context.json({ data: await service.getRegistry() });
    })
    .post("/modules/sync/plan", async (context) => {
      await assertEmptyJsonBody(context.req.raw);
      return context.json({ data: await service.plan() });
    })
    .post("/modules/sync/apply", async (context) => {
      const input = applyModuleSyncRequestSchema.parse(await context.req.json());
      return context.json({
        data: await service.apply(input, context.get("authContext")?.userId ?? null),
      });
    });
}
