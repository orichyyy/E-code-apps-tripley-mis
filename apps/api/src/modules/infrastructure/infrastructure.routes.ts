import {
  createExportTaskRequestSchema,
  createLogExportTaskRequestSchema,
  createNotificationTemplateRequestSchema,
  createScheduledTaskRequestSchema,
  sendTestEmailNotificationRequestSchema,
  updateNotificationTemplateRequestSchema,
  updateScheduledTaskRequestSchema,
  emailDeliveryListQuerySchema,
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import { createKnownError } from "../../core/errors/error-codes";
import { assertEmptyJsonBody } from "../core-foundation/request-body";
import { toContentDisposition } from "./file-management";
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
  files: "file_operation",
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
  routes.post("/files/upload", async (context) => {
    const uploaded = await readUploadedFile(context.req);
    return context.json(
      {
        data: await services.uploadFile({
          ...uploaded,
          actorId: actorId(context),
        }),
      },
      201,
    );
  });
  routes.get("/files/:id", async (context) =>
    context.json({ data: await services.getFile(context.req.param("id")) }),
  );
  routes.get("/files/:id/download", async (context) => {
    const result = await services.getFileContent(context.req.param("id"), "download");
    if (result.kind === "redirect") return privateRedirect(result.url);
    return new Response(toArrayBuffer(result.body), {
      status: 200,
      headers: {
        "content-type": String(result.file.contentType),
        "content-length": String(result.body.byteLength),
        "content-disposition": toContentDisposition(String(result.file.originalName)),
      },
    });
  });
  routes.get("/files/:id/preview", async (context) => {
    const result = await services.getFileContent(context.req.param("id"), "preview");
    if (result.kind === "redirect") return privateRedirect(result.url);
    return new Response(toArrayBuffer(result.body), {
      status: 200,
      headers: {
        "content-type": String(result.file.contentType),
        "content-length": String(result.body.byteLength),
      },
    });
  });
  routes.get("/files/:id/references", async (context) => {
    return context.json({ data: await services.listFileReferences(context.req.param("id")) });
  });
  routes.delete("/files/:id", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({
      data: await services.deleteFile(context.req.param("id"), actorId(context)),
    });
  });

  routes.get("/notifications", async (context) => {
    const auth = requireAuth(context);
    return context.json({ data: await services.listNotifications(auth.userId) });
  });
  routes.post("/notifications/:id/read", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({
      data: await services.updateNotificationStatus(
        context.req.param("id"),
        "read",
        actorId(context),
      ),
    });
  });
  routes.post("/notifications/:id/archive", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({
      data: await services.updateNotificationStatus(
        context.req.param("id"),
        "archived",
        actorId(context),
      ),
    });
  });
  routes.delete("/notifications/:id", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({
      data: await services.updateNotificationStatus(
        context.req.param("id"),
        "deleted",
        actorId(context),
      ),
    });
  });

  routes.post("/notifications/email/test", async (context) => {
    const input = sendTestEmailNotificationRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.sendTestEmail(input) });
  });

  routes.get("/email-deliveries", async (context) => {
    const query = emailDeliveryListQuerySchema.parse(context.req.query());
    return context.json({ data: await services.listEmailDeliveries(query) });
  });
  routes.get("/email-deliveries/:id", async (context) => {
    return context.json({ data: await services.getEmailDelivery(context.req.param("id")) });
  });

  routes.get("/notification-templates", async (context) =>
    context.json({ data: await services.listNotificationTemplates() }),
  );
  routes.post("/notification-templates", async (context) => {
    const input = createNotificationTemplateRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.createNotificationTemplate(input) }, 201);
  });
  routes.patch("/notification-templates/:id", async (context) => {
    const input = updateNotificationTemplateRequestSchema.parse(await context.req.json());
    return context.json({
      data: await services.updateNotificationTemplate(context.req.param("id"), input),
    });
  });

  routes.get("/scheduled-tasks", async (context) =>
    context.json({ data: await services.listScheduledTasks() }),
  );
  routes.post("/scheduled-tasks", async (context) => {
    const input = createScheduledTaskRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.createScheduledTask(input) }, 201);
  });
  routes.patch("/scheduled-tasks/:id", async (context) => {
    const input = updateScheduledTaskRequestSchema.parse(await context.req.json());
    return context.json({
      data: await services.updateScheduledTask(context.req.param("id"), input),
    });
  });
  routes.post("/scheduled-tasks/:id/enable", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({
      data: await services.setScheduledTaskStatus(context.req.param("id"), true),
    });
  });
  routes.post("/scheduled-tasks/:id/disable", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({
      data: await services.setScheduledTaskStatus(context.req.param("id"), false),
    });
  });
  routes.post("/scheduled-tasks/:id/run", async (context) => {
    await assertEmptyJsonBody(context.req.raw);
    return context.json({ data: await services.enqueueScheduledTaskRun(context.req.param("id")) });
  });

  routes.get("/import-export/tasks", async (context) =>
    context.json({ data: await services.listImportExportTasks() }),
  );
  routes.post("/import-export/export", async (context) => {
    const input = createExportTaskRequestSchema.parse(await context.req.json());
    return context.json({ data: await services.createExportTask(input, actorId(context)) }, 201);
  });
  routes.get("/import-export/tasks/:id", async (context) => {
    return context.json({ data: await services.getImportExportTask(context.req.param("id")) });
  });

  return routes;
}

function privateRedirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location: url, "cache-control": "private, no-store" },
  });
}

function actorId(context: {
  get: (key: "authContext") => AuthContextVariables["authContext"];
}): string | null {
  return context.get("authContext")?.userId ?? null;
}

function requireAuth(context: {
  get: (key: "authContext") => AuthContextVariables["authContext"];
}) {
  const auth = context.get("authContext");
  if (!auth) throw createKnownError("AUTH_TOKEN_EXPIRED");
  return auth;
}

async function readUploadedFile(request: {
  parseBody: () => Promise<Record<string, FormDataEntryValue | FormDataEntryValue[]>>;
}) {
  const body = await request.parseBody();
  const file = Array.isArray(body.file) ? body.file[0] : body.file;
  if (!isUploadedFile(file))
    throw createKnownError("VALIDATION_INVALID_REQUEST", { field: "file" });
  return {
    originalName: file.name,
    contentType: file.type,
    body: new Uint8Array(await file.arrayBuffer()),
  };
}

function isUploadedFile(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "type" in value &&
    "arrayBuffer" in value &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function"
  );
}

function toArrayBuffer(body: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(body.byteLength);
  copy.set(body);
  return copy.buffer;
}
