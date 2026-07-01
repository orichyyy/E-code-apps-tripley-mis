import {
  assignUserOrganizationRoleRequestSchema,
  createUserRequestSchema,
  resetPasswordRequestSchema,
  updateUserRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { BackendCoreServices } from "./services";

export function createUserRoutes(services: BackendCoreServices) {
  const routes = new Hono();

  routes.get("/users", (context) => {
    return context.json({ data: services.listUsers() });
  });

  routes.post("/users", async (context) => {
    const input = createUserRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.createUser(input) }, 201);
  });

  routes.get("/users/:id", (context) => {
    return context.json({ data: services.listUsers().find((user) => user.id === context.req.param("id")) });
  });

  routes.patch("/users/:id", async (context) => {
    const input = updateUserRequestSchema.parse(await context.req.json());
    return context.json({ data: services.updateUser(context.req.param("id"), input) });
  });

  routes.post("/users/:id/disable", (context) => {
    return context.json({ data: services.setUserStatus(context.req.param("id"), "disabled") });
  });

  routes.post("/users/:id/enable", (context) => {
    return context.json({ data: services.setUserStatus(context.req.param("id"), "enabled") });
  });

  routes.post("/users/:id/lock", (context) => {
    return context.json({ data: services.setUserStatus(context.req.param("id"), "locked") });
  });

  routes.post("/users/:id/unlock", (context) => {
    return context.json({ data: services.setUserStatus(context.req.param("id"), "enabled") });
  });

  routes.post("/users/:id/reset-password", async (context) => {
    const input = resetPasswordRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.resetUserPassword(context.req.param("id"), input) });
  });

  routes.delete("/users/:id", (context) => {
    return context.json({ data: services.deleteUser(context.req.param("id")) });
  });

  routes.post("/users/:id/organizations", async (context) => {
    const input = assignUserOrganizationRoleRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.assignUserOrganizationRole(context.req.param("id"), input) });
  });

  routes.delete("/users/:id/organizations/:organizationId", async (context) => {
    return context.json({
      data: await services.removeUserOrganizationRole(
        context.req.param("id"),
        context.req.param("organizationId")
      )
    });
  });

  return routes;
}
