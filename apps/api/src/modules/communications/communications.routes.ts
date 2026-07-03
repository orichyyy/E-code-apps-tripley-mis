import {
  createAnnouncementRequestSchema,
  createWebhookSubscriptionRequestSchema,
  updateAnnouncementRequestSchema,
  updateWebhookSubscriptionRequestSchema
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import { assertEmptyJsonBody } from "../core-foundation/request-body";
import type { CommunicationsServices } from "./communications.service";

type CommunicationsRouteBindings = {
  Variables: AuthContextVariables;
};

export function createCommunicationsRoutes(services: CommunicationsServices) {
  return new Hono<CommunicationsRouteBindings>()
    .get("/announcements", async (context) => {
      return context.json({ data: await services.listAnnouncements() });
    })
    .post("/announcements", async (context) => {
      const input = createAnnouncementRequestSchema.parse(await context.req.json());
      return context.json({ data: await services.createAnnouncement(input, actorId(context)) }, 201);
    })
    .patch("/announcements/:id", async (context) => {
      const input = updateAnnouncementRequestSchema.parse(await context.req.json());
      return context.json({
        data: await services.updateAnnouncement(context.req.param("id"), input, actorId(context))
      });
    })
    .post("/announcements/:id/publish", async (context) => {
      await assertEmptyJsonBody(context.req.raw);
      return context.json({
        data: await services.setAnnouncementPublished(context.req.param("id"), true, actorId(context))
      });
    })
    .post("/announcements/:id/unpublish", async (context) => {
      await assertEmptyJsonBody(context.req.raw);
      return context.json({
        data: await services.setAnnouncementPublished(context.req.param("id"), false, actorId(context))
      });
    })
    .get("/webhooks", async (context) => {
      return context.json({ data: await services.listWebhooks() });
    })
    .post("/webhooks", async (context) => {
      const input = createWebhookSubscriptionRequestSchema.parse(await context.req.json());
      return context.json({ data: await services.createWebhook(input, actorId(context)) }, 201);
    })
    .patch("/webhooks/:id", async (context) => {
      const input = updateWebhookSubscriptionRequestSchema.parse(await context.req.json());
      return context.json({ data: await services.updateWebhook(context.req.param("id"), input, actorId(context)) });
    });
}

function actorId(context: { get: (key: "authContext") => AuthContextVariables["authContext"] }): string | null {
  return context.get("authContext")?.userId ?? null;
}
