import {
  createMenuRequestSchema,
  updateMenuRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { BackendCoreServices } from "./services";

export function createMenuRoutes(services: BackendCoreServices) {
  const routes = new Hono();

  routes.get("/menus/tree", (context) => {
    return context.json({ data: services.listMenus() });
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
    return context.json({ data: await services.deleteMenu(context.req.param("id")) });
  });

  return routes;
}
