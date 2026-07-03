import {
  createDictionaryItemRequestSchema,
  createDictionaryTypeRequestSchema,
  updateDictionaryItemRequestSchema,
  updateDictionaryTypeRequestSchema,
  updateI18nMessageRequestSchema,
  updateSystemConfigRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import type { SystemManagementServices } from "./system-management.service";

type SystemManagementRouteBindings = {
  Variables: AuthContextVariables;
};

export function createSystemManagementRoutes(services: SystemManagementServices) {
  const routes = new Hono<SystemManagementRouteBindings>();

  routes.get("/system-config", async (context) => {
    return context.json({ data: await services.listSystemConfigs() });
  });

  routes.patch("/system-config/:key", async (context) => {
    const input = updateSystemConfigRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.updateSystemConfig(context.req.param("key"), input) });
  });

  routes.get("/dictionary-types", async (context) => {
    return context.json({ data: await services.listDictionaryTypes() });
  });

  routes.post("/dictionary-types", async (context) => {
    const input = createDictionaryTypeRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.createDictionaryType(input) }, 201);
  });

  routes.patch("/dictionary-types/:id", async (context) => {
    const input = updateDictionaryTypeRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.updateDictionaryType(context.req.param("id"), input) });
  });

  routes.get("/dictionary-types/:id/items", async (context) => {
    return context.json({ data: await services.listDictionaryItems(context.req.param("id")) });
  });

  routes.post("/dictionary-types/:id/items", async (context) => {
    const input = createDictionaryItemRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.createDictionaryItem(context.req.param("id"), input) }, 201);
  });

  routes.patch("/dictionary-items/:id", async (context) => {
    const input = updateDictionaryItemRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.updateDictionaryItem(context.req.param("id"), input) });
  });

  routes.get("/i18n/messages", async (context) => {
    return context.json({ data: await services.listI18nMessages() });
  });

  routes.patch("/i18n/messages/:id", async (context) => {
    const input = updateI18nMessageRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.updateI18nMessage(context.req.param("id"), input) });
  });

  return routes;
}
