import {
  updateRoleDataPermissionsRequestSchema,
  updateRoleFieldPermissionsRequestSchema,
  updateUserPermissionOverridesRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import type { BackendCoreServices } from "./services";

type PermissionExtensionRouteBindings = {
  Variables: AuthContextVariables;
};

export function createPermissionExtensionRoutes(services: BackendCoreServices) {
  return new Hono<PermissionExtensionRouteBindings>()
    .get("/roles/:id/data-permissions", (context) => {
      return context.json({ data: services.listRoleDataPermissions(context.req.param("id")) });
    })
    .put("/roles/:id/data-permissions", async (context) => {
      const authContext = context.get("authContext");
      const input = updateRoleDataPermissionsRequestSchema.parse(await context.req.json());
      return context.json({
        data: await services.updateRoleDataPermissions(
          context.req.param("id"),
          input,
          authContext?.userId ?? null
        )
      });
    })
    .get("/roles/:id/field-permissions", (context) => {
      return context.json({ data: services.listRoleFieldPermissions(context.req.param("id")) });
    })
    .put("/roles/:id/field-permissions", async (context) => {
      const authContext = context.get("authContext");
      const input = updateRoleFieldPermissionsRequestSchema.parse(await context.req.json());
      return context.json({
        data: await services.updateRoleFieldPermissions(
          context.req.param("id"),
          input,
          authContext?.userId ?? null
        )
      });
    })
    .get("/permissions/user-overrides/:userId", (context) => {
      return context.json({ data: services.listUserPermissionOverrides(context.req.param("userId")) });
    })
    .put("/permissions/user-overrides/:userId", async (context) => {
      const authContext = context.get("authContext");
      const input = updateUserPermissionOverridesRequestSchema.parse(await context.req.json());
      return context.json({
        data: await services.updateUserPermissionOverrides(
          context.req.param("userId"),
          input,
          authContext?.userId ?? null
        )
      });
    });
}
