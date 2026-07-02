import { baseApiPermissionManifest } from "@web-admin-base/contracts";
import type { Context, MiddlewareHandler, Next } from "hono";

import type { AuthContextVariables } from "../core/auth-context/auth-context";
import type { RequestIdVariables } from "./request-id";
import type { BackendCoreServices } from "../modules/core-foundation/services";

type AuthorizationBindings = {
  Variables: RequestIdVariables & AuthContextVariables;
};

export function createApiAuthorizationMiddleware(
  services: BackendCoreServices
): MiddlewareHandler<AuthorizationBindings> {
  return async (context: Context<AuthorizationBindings>, next: Next) => {
    const apiPermission = findApiPermission(context.req.method, context.req.path);
    const authContext = apiPermission?.public
      ? null
      : services.findAuthContext(context.req.header("authorization"));

    context.set("authContext", authContext);

    if (apiPermission) {
      await services.requireApiPermission(authContext, apiPermission);
    }

    await next();
  };
}

function findApiPermission(method: string, path: string) {
  return baseApiPermissionManifest.find(
    (entry) => entry.method === method && matchesPathPattern(entry.path, path)
  );
}

function matchesPathPattern(pattern: string, path: string): boolean {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
}
