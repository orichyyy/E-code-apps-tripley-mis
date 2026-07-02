import {
  createOrganizationRequestSchema,
  updateOrganizationRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import type { BackendCoreServices } from "./services";

type OrganizationRouteBindings = {
  Variables: AuthContextVariables;
};

export function createOrganizationRoutes(services: BackendCoreServices) {
  const routes = new Hono<OrganizationRouteBindings>();

  routes.get("/organizations/tree", (context) => {
    return context.json({ data: services.listOrganizations() });
  });

  routes.post("/organizations", async (context) => {
    const input = createOrganizationRequestSchema.parse(await context.req.json());
    return context.json({ data: services.createOrganization(input) }, 201);
  });

  routes.get("/organizations/:id", (context) => {
    return context.json({ data: services.getOrganization(context.req.param("id")) });
  });

  routes.patch("/organizations/:id", async (context) => {
    const input = updateOrganizationRequestSchema.parse(await context.req.json());
    return context.json({ data: services.updateOrganization(context.req.param("id"), input) });
  });

  routes.post("/organizations/:id/disable", (context) => {
    return context.json({ data: services.disableOrganization(context.req.param("id")) });
  });

  routes.post("/organizations/:id/enable", (context) => {
    return context.json({ data: services.enableOrganization(context.req.param("id")) });
  });

  routes.delete("/organizations/:id", (context) => {
    const authContext = context.get("authContext");
    return context.json({
      data: services.deleteOrganization(context.req.param("id"), authContext?.userId ?? null)
    });
  });

  return routes;
}
