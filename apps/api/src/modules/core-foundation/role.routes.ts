import {
  createRoleRequestSchema,
  updateRolePermissionsRequestSchema,
  updateRoleRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import { createKnownError } from "../../core/errors/error-codes";
import { pageItems } from "./pagination";
import type { ApiPermissionListFilters, PermissionListFilters } from "./permission.service";
import type { RoleListFilters } from "./role.service";
import type { BackendCoreServices } from "./services";

type RoleRouteBindings = {
  Variables: AuthContextVariables;
};

export function createRoleRoutes(services: BackendCoreServices) {
  const routes = new Hono<RoleRouteBindings>();

  routes.get("/roles", (context) => {
    return context.json({
      data: pageItems(services.listRoles({
        keyword: context.req.query("keyword"),
        status: context.req.query("status") as RoleListFilters["status"] | undefined
      }), {
        page: context.req.query("page"),
        pageSize: context.req.query("pageSize")
      })
    });
  });

  routes.post("/roles", async (context) => {
    const authContext = context.get("authContext");
    const input = createRoleRequestSchema.parse(await context.req.json());
    return context.json({ data: services.createRole(input, authContext?.userId ?? null) }, 201);
  });

  routes.get("/roles/:id", (context) => {
    return context.json({ data: services.getRole(context.req.param("id")) });
  });

  routes.patch("/roles/:id", async (context) => {
    const authContext = context.get("authContext");
    const input = updateRoleRequestSchema.parse(await context.req.json());
    return context.json({
      data: await services.updateRole(context.req.param("id"), input, authContext?.userId ?? null)
    });
  });

  routes.post("/roles/:id/enable", async (context) => {
    const authContext = context.get("authContext");
    return context.json({
      data: await services.setRoleStatus(context.req.param("id"), "enabled", authContext?.userId ?? null)
    });
  });

  routes.post("/roles/:id/disable", async (context) => {
    const authContext = context.get("authContext");
    return context.json({
      data: await services.setRoleStatus(context.req.param("id"), "disabled", authContext?.userId ?? null)
    });
  });

  routes.delete("/roles/:id", async (context) => {
    const authContext = context.get("authContext");
    return context.json({
      data: await services.deleteRole(context.req.param("id"), authContext?.userId ?? null)
    });
  });

  routes.post("/roles/:id/copy", (context) => {
    const authContext = context.get("authContext");
    return context.json({
      data: services.copyRole(context.req.param("id"), authContext?.userId ?? null)
    }, 201);
  });

  routes.get("/roles/:id/permissions", (context) => {
    return context.json({ data: services.listRolePermissionCodes(context.req.param("id")) });
  });

  routes.put("/roles/:id/permissions", async (context) => {
    const authContext = context.get("authContext");
    const input = updateRolePermissionsRequestSchema.parse(await context.req.json());
    return context.json({
      data: await services.updateRolePermissions(
        context.req.param("id"),
        input,
        authContext?.userId ?? null
      )
    });
  });

  routes.get("/permissions", (context) => {
    const permissions = services.listPermissions({
      action: context.req.query("action"),
      keyword: context.req.query("keyword"),
      module: context.req.query("module"),
      permissionType: context.req.query("type") as PermissionListFilters["permissionType"] | undefined,
      resource: context.req.query("resource"),
      source: context.req.query("source"),
      status: context.req.query("status") as PermissionListFilters["status"] | undefined
    });
    return context.json({
      data: hasPaginationQuery(context)
        ? pageItems(permissions, {
            page: context.req.query("page"),
            pageSize: context.req.query("pageSize")
          })
        : permissions
    });
  });

  routes.post("/permissions/sync", async (context) => {
    return context.json({ data: await services.syncPermissions() });
  });

  routes.get("/permissions/api", (context) => {
    const apiPermissions = services.listApiPermissions({
      keyword: context.req.query("keyword"),
      logLevel: context.req.query("logLevel") as ApiPermissionListFilters["logLevel"] | undefined,
      method: context.req.query("method"),
      module: context.req.query("module"),
      public: parseOptionalBoolean(context.req.query("public")),
      status: context.req.query("status") as ApiPermissionListFilters["status"] | undefined
    });
    return context.json({
      data: hasPaginationQuery(context)
        ? pageItems(apiPermissions, {
            page: context.req.query("page"),
            pageSize: context.req.query("pageSize")
          })
        : apiPermissions
    });
  });

  routes.post("/permissions/api/sync", async (context) => {
    const result = await services.syncPermissions();
    return context.json({ data: result.apiPermissions });
  });

  return routes;
}

function hasPaginationQuery(context: { req: { query: (name: string) => string | undefined } }): boolean {
  return context.req.query("page") !== undefined || context.req.query("pageSize") !== undefined;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw createKnownError("VALIDATION_INVALID_REQUEST");
}
