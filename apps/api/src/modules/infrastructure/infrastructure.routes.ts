import {
  createExportTaskRequestSchema,
  createLogExportTaskRequestSchema,
  createNotificationTemplateRequestSchema,
  createScheduledTaskRequestSchema,
  updateNotificationTemplateRequestSchema,
  updateScheduledTaskRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import { createKnownError } from "../../core/errors/error-codes";
import { assertEmptyJsonBody } from "../core-foundation/request-body";
import type { InfrastructureServices } from "./infrastructure.service";
import type { LogType } from "./infrastructure.types";

type InfrastructureRouteBindings = {
  Variables: AuthContextVariables;
};

const logPathToType = {
  login: "login",
  operation: "operation",
  access: "access",
  api: "api_call",
  exception: "exception",
  security: "security",
  jobs: "scheduler",
  files: "file_operation"
} as const satisfies Record<string, LogType>;

export function createInfrastructureRoutes(services: InfrastructureServices) {
  const routes = new Hono<InfrastructureRouteBindings>();

  for (const [path, logType] of Object.entries(logPathToType)) {
    routes.get(`/logs/${path}`, async (context) => {
      return context.json({ data: await services.listLogs(logType) });
    });
  }

  routes.post("/logs/export", async (context) => {
    const input = createLogExportTaskRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.createLogExportTask(input, actorId(context)) }, 201);
  });

  routes.get("/files", async (context) => context.json({ data: await services.listFiles() }));
  routes.get("/files/:id", async (context) => context.json({ data: await services.getFile(context.req.param("id")) }));
  routes.delete("/files/:id", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({ data: await services.deleteFile(context.req.param("id"), actorId(context)) });
  });

  routes.get("/notifications", async (context) => {
    const auth = requireAuth(context);
    return context.json({ data: await services.listNotifications(auth.userId) });
  });
  routes.post("/notifications/:id/read", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({ data: await services.updateNotificationStatus(context.req.param("id"), "read", actorId(context)) });
  });
  routes.post("/notifications/:id/archive", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({ data: await services.updateNotificationStatus(context.req.param("id"), "archived", actorId(context)) });
  });
  routes.delete("/notifications/:id", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({ data: await services.updateNotificationStatus(context.req.param("id"), "deleted", actorId(context)) });
  });

  routes.get("/notification-templates", async (context) => context.json({ data: await services.listNotificationTemplates() }));
  routes.post("/notification-templates", async (context) => {
    const input = createNotificationTemplateRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.createNotificationTemplate(input) }, 201);
  });
  routes.patch("/notification-templates/:id", async (context) => {
    const input = updateNotificationTemplateRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.updateNotificationTemplate(context.req.param("id"), input) });
  });

  routes.get("/scheduled-tasks", async (context) => context.json({ data: await services.listScheduledTasks() }));
  routes.post("/scheduled-tasks", async (context) => {
    const input = createScheduledTaskRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.createScheduledTask(input) }, 201);
  });
  routes.patch("/scheduled-tasks/:id", async (context) => {
    const input = updateScheduledTaskRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.updateScheduledTask(context.req.param("id"), input) });
  });
  routes.post("/scheduled-tasks/:id/enable", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({ data: await services.setScheduledTaskStatus(context.req.param("id"), true) });
  });
  routes.post("/scheduled-tasks/:id/disable", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({ data: await services.setScheduledTaskStatus(context.req.param("id"), false) });
  });
  routes.post("/scheduled-tasks/:id/run", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({ data: await services.enqueueScheduledTaskRun(context.req.param("id")) });
  });

  routes.get("/import-export/tasks", async (context) => context.json({ data: await services.listImportExportTasks() }));
  routes.post("/import-export/export", async (context) => {
    const input = createExportTaskRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.createExportTask(input, actorId(context)) }, 201);
  });
  routes.get("/import-export/tasks/:id", async (context) => {
    return context.json({ data: await services.getImportExportTask(context.req.param("id")) });
  });

  return routes;
}

function actorId(context: { get: (key: "authContext") => AuthContextVariables["authContext"] }): string | null {
  return context.get("authContext")?.userId ?? null;
}

function requireAuth(context: { get: (key: "authContext") => AuthContextVariables["authContext"] }) {
  const auth = context.get("authContext");
  if (!auth) throw createKnownError("AUTH_TOKEN_EXPIRED");
  return auth;
}
