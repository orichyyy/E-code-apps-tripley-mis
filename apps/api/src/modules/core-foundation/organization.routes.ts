import {
  createOrganizationRequestSchema,
  updateOrganizationDepthConfigRequestSchema,
  updateOrganizationRequestSchema,
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import { assertEmptyJsonBody } from "./request-body";
import type { BackendCoreServices } from "./services";

type OrganizationRouteBindings = {
  Variables: AuthContextVariables;
};

export function createOrganizationRoutes(services: BackendCoreServices) {
  const routes = new Hono<OrganizationRouteBindings>();

  routes.get("/organizations/tree", (context) => {
    return context.json({ data: services.listOrganizationTree() });
  });

  routes.get("/organizations/config/depth", (context) => {
    return context.json({ data: services.getOrganizationDepthConfig() });
  });

  routes.patch("/organizations/config/depth", async (context) => {
    const input = updateOrganizationDepthConfigRequestSchema.parse(await context.req.json());
    return context.json({ data: services.updateOrganizationDepthConfig(input) });
  });

  routes.post("/organizations", async (context) => {
    const authContext = context.get("authContext");
    const input = createOrganizationRequestSchema.parse(await context.req.json());
    return context.json(
      {
        data: await services.createOrganization(input, authContext?.userId ?? null),
      },
      201,
    );
  });

  routes.get("/organizations/:id", (context) => {
    return context.json({ data: services.getOrganization(context.req.param("id")) });
  });

  routes.patch("/organizations/:id", async (context) => {
    const authContext = context.get("authContext");
    const input = updateOrganizationRequestSchema.parse(await context.req.json());
    return context.json({
      data: await services.updateOrganization(
        context.req.param("id"),
        input,
        authContext?.userId ?? null,
      ),
    });
  });

  routes.post("/organizations/:id/disable", async (context) => {
    const authContext = context.get("authContext");
    await assertEmptyJsonBody(context.req.raw);
    return context.json({
      data: await services.disableOrganization(
        context.req.param("id"),
        authContext?.userId ?? null,
      ),
    });
  });

  routes.post("/organizations/:id/enable", async (context) => {
    const authContext = context.get("authContext");
    await assertEmptyJsonBody(context.req.raw);
    return context.json({
      data: await services.enableOrganization(context.req.param("id"), authContext?.userId ?? null),
    });
  });

  routes.delete("/organizations/:id", async (context) => {
    const authContext = context.get("authContext");
    await assertEmptyJsonBody(context.req.raw);
    return context.json({
      data: await services.deleteOrganization(context.req.param("id"), authContext?.userId ?? null),
    });
  });

  return routes;
}
