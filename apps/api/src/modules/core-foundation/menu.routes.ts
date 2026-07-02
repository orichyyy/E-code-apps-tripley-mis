import {
  createMenuRequestSchema,
  integerIdStringSchema,
  updateMenuApiBindingsRequestSchema,
  updateMenuRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import type { BackendCoreServices } from "./services";

type MenuRouteBindings = {
  Variables: AuthContextVariables;
};

export function createMenuRoutes(services: BackendCoreServices) {
  const routes = new Hono<MenuRouteBindings>();

  routes.get("/menus/tree", (context) => {
    return context.json({ data: services.listMenuTree() });
  });

  routes.post("/menus", async (context) => {
    const input = createMenuRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.createMenu(input) }, 201);
  });

  routes.patch("/menus/:id", async (context) => {
    const input = updateMenuRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.updateMenu(context.req.param("id"), input) });
  });

  routes.delete("/menus/:id", async (context) => {
    const authContext = context.get("authContext");
    return context.json({
      data: await services.deleteMenu(context.req.param("id"), authContext?.userId ?? null)
    });
  });

  routes.put("/menus/:id/api-bindings", async (context) => {
    const menuId = integerIdStringSchema.parse(context.req.param("id"));
    const input = updateMenuApiBindingsRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.updateMenuApiBindings(menuId, input) });
  });

  return routes;
}
