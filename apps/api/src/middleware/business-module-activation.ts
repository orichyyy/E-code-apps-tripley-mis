import type { Context, MiddlewareHandler, Next } from "hono";

import { createKnownError } from "../core/errors/error-codes";
import type { ModuleLifecycleService } from "../modules/module-lifecycle/module-lifecycle.service";

export function createBusinessModuleActivationMiddleware(
  service: ModuleLifecycleService,
): MiddlewareHandler {
  return async (context: Context, next: Next) => {
    const moduleCode = moduleCodeFromApiPath(context.req.path);
    if (
      moduleCode &&
      service.hasReleaseModule(moduleCode) &&
      !(await service.isModuleActive(moduleCode))
    ) {
      throw createKnownError("MODULE_NOT_SYNCHRONIZED");
    }
    await next();
  };
}

function moduleCodeFromApiPath(path: string): string | null {
  const match = /^\/api\/modules\/([^/]+)\//.exec(path);
  return match?.[1] ?? null;
}
