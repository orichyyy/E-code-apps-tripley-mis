import { baseApiPermissionManifest } from "@web-admin-base/contracts";
import type { Context, MiddlewareHandler, Next } from "hono";

import type { AuthContextVariables } from "../core/auth-context/auth-context";
import type { RequestIdVariables } from "./request-id";
import type { BackendCoreServices } from "../modules/core-foundation/services";
import type { ModuleLifecycleService } from "../modules/module-lifecycle/module-lifecycle.service";

type AuthorizationBindings = {
  Variables: RequestIdVariables & AuthContextVariables;
};

export function createApiAuthorizationMiddleware(
  services: BackendCoreServices,
  moduleLifecycle?: ModuleLifecycleService,
): MiddlewareHandler<AuthorizationBindings> {
  return async (context: Context<AuthorizationBindings>, next: Next) => {
    const apiPermission =
      findApiPermission(context.req.method, context.req.path) ??
      moduleLifecycle?.findReleaseApiPermission(context.req.method, context.req.path);
    const authContext =
      apiPermission && !apiPermission.public
        ? services.findAuthContext(context.req.header("authorization"))
        : null;

    context.set("authContext", authContext);

    if (apiPermission) {
      await services.requireApiPermission(
        authContext,
        isDeferredFileContentAuthorization(context.req.method, context.req.path)
          ? { ...apiPermission, requiredPermission: undefined }
          : apiPermission,
      );
    }

    await next();
  };
}

function isDeferredFileContentAuthorization(method: string, path: string): boolean {
  return (
    method === "GET" &&
    (/^\/api\/files\/[^/]+\/download$/.test(path) || /^\/api\/files\/[^/]+\/preview$/.test(path))
  );
}

function findApiPermission(method: string, path: string) {
  return baseApiPermissionManifest.find(
    (entry) => entry.method === method && matchesPathPattern(entry.path, path),
  );
}

function matchesPathPattern(pattern: string, path: string): boolean {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
}
