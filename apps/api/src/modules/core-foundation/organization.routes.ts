import {
  createOrganizationRequestSchema,
  updateOrganizationRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { BackendCoreServices } from "./services";

export function createOrganizationRoutes(services: BackendCoreServices) {
  const routes = new Hono();

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
    return context.json({ data: services.deleteOrganization(context.req.param("id")) });
  });

  return routes;
}
