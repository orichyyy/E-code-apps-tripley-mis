import {
  createRoleRequestSchema,
  updateRolePermissionsRequestSchema,
  updateRoleRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { BackendCoreServices } from "./services";

export function createRoleRoutes(services: BackendCoreServices) {
  const routes = new Hono();

  routes.get("/roles", (context) => {
    return context.json({ data: services.listRoles() });
  });

  routes.post("/roles", async (context) => {
    const input = createRoleRequestSchema.parse(await context.req.json());
    return context.json({ data: services.createRole(input) }, 201);
  });

  routes.get("/roles/:id", (context) => {
    return context.json({ data: services.listRoles().find((role) => role.id === context.req.param("id")) });
  });

  routes.patch("/roles/:id", async (context) => {
    const input = updateRoleRequestSchema.parse(await context.req.json());
    return context.json({ data: services.updateRole(context.req.param("id"), input) });
  });

  routes.delete("/roles/:id", (context) => {
    return context.json({ data: services.deleteRole(context.req.param("id")) });
  });

  routes.post("/roles/:id/copy", (context) => {
    return context.json({ data: services.copyRole(context.req.param("id")) }, 201);
  });

  routes.put("/roles/:id/permissions", async (context) => {
    const input = updateRolePermissionsRequestSchema.parse(await context.req.json());
    return context.json({ data: services.updateRolePermissions(context.req.param("id"), input) });
  });

  routes.get("/permissions", (context) => {
    return context.json({ data: services.listPermissions() });
  });

  return routes;
}
