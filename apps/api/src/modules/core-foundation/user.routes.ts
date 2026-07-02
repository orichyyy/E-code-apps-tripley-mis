import {
  assignUserOrganizationRoleRequestSchema,
  createUserRequestSchema,
  resetPasswordRequestSchema,
  updateUserRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import type { BackendCoreServices } from "./services";

type UserRouteBindings = {
  Variables: AuthContextVariables;
};

export function createUserRoutes(services: BackendCoreServices) {
  const routes = new Hono<UserRouteBindings>();

  routes.get("/users", (context) => {
    return context.json({ data: services.listUsers() });
  });

  routes.post("/users", async (context) => {
    const authContext = context.get("authContext");
    const input = createUserRequestSchema.parse(await context.req.json());
    return context.json({
      data: await services.createUser(input, authContext?.userId ?? null)
    }, 201);
  });

  routes.get("/users/:id", (context) => {
    return context.json({ data: services.getUser(context.req.param("id")) });
  });

  routes.patch("/users/:id", async (context) => {
    const authContext = context.get("authContext");
    const input = updateUserRequestSchema.parse(await context.req.json());
    return context.json({
      data: services.updateUser(context.req.param("id"), input, authContext?.userId ?? null)
    });
  });

  routes.post("/users/:id/disable", (context) => {
    const authContext = context.get("authContext");
    return context.json({
      data: services.setUserStatus(context.req.param("id"), "disabled", authContext?.userId ?? null)
    });
  });

  routes.post("/users/:id/enable", (context) => {
    const authContext = context.get("authContext");
    return context.json({
      data: services.setUserStatus(context.req.param("id"), "enabled", authContext?.userId ?? null)
    });
  });

  routes.post("/users/:id/lock", (context) => {
    const authContext = context.get("authContext");
    return context.json({
      data: services.setUserStatus(context.req.param("id"), "locked", authContext?.userId ?? null)
    });
  });

  routes.post("/users/:id/unlock", (context) => {
    const authContext = context.get("authContext");
    return context.json({
      data: services.setUserStatus(context.req.param("id"), "enabled", authContext?.userId ?? null)
    });
  });

  routes.post("/users/:id/reset-password", async (context) => {
    const authContext = context.get("authContext");
    const input = resetPasswordRequestSchema.parse(await context.req.json());
    return context.json({
      data: await services.resetUserPassword(
        context.req.param("id"),
        input,
        authContext?.userId ?? null
      )
    });
  });

  routes.delete("/users/:id", async (context) => {
    const authContext = context.get("authContext");
    return context.json({
      data: await services.deleteUser(context.req.param("id"), authContext?.userId ?? null)
    });
  });

  routes.get("/users/:id/organizations", (context) => {
    return context.json({ data: services.listUserOrganizationRoles(context.req.param("id")) });
  });

  routes.post("/users/:id/organizations", async (context) => {
    const authContext = context.get("authContext");
    const input = assignUserOrganizationRoleRequestSchema.parse(await context.req.json());
    return context.json({
      data: await services.assignUserOrganizationRole(
        context.req.param("id"),
        input,
        authContext?.userId ?? null
      )
    });
  });

  routes.delete("/users/:id/organizations/:organizationId", async (context) => {
    const authContext = context.get("authContext");
    return context.json({
      data: await services.removeUserOrganizationRole(
        context.req.param("id"),
        context.req.param("organizationId"),
        authContext?.userId ?? null
      )
    });
  });

  return routes;
}
