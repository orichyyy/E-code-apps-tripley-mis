import {
  createAnnouncementRequestSchema,
  createWebhookSubscriptionRequestSchema,
  listAnnouncementsQuerySchema,
  listCurrentAnnouncementsQuerySchema,
  listWebhookDeliveriesQuerySchema,
  updateAnnouncementRequestSchema,
  updateWebhookSubscriptionRequestSchema,
} from "@web-admin-base/contracts";
import { Hono } from "hono";

import type { AuthContextVariables } from "../../core/auth-context/auth-context";
import { createKnownError } from "../../core/errors/error-codes";
import { assertEmptyJsonBody } from "../core-foundation/request-body";
import type { CommunicationsServices } from "./communications.service";

type CommunicationsRouteBindings = {
  Variables: AuthContextVariables;
};

export function createCommunicationsRoutes(services: CommunicationsServices) {
  return new Hono<CommunicationsRouteBindings>()
    .get("/announcements", async (context) => {
      const query = listAnnouncementsQuerySchema.parse(context.req.query());
      return context.json({ data: await services.listAnnouncements(query) });
    })
    .get("/announcements/current", async (context) => {
      const authContext = context.get("authContext");
      if (!authContext) throw createKnownError("AUTH_TOKEN_EXPIRED");
      const query = listCurrentAnnouncementsQuerySchema.parse(context.req.query());
      return context.json({
        data: await services.listCurrentAnnouncements(query, authContext.currentOrganizationId),
      });
    })
    .post("/announcements", async (context) => {
      const input = createAnnouncementRequestSchema.parse(await context.req.json());
      return context.json(
        { data: await services.createAnnouncement(input, actorId(context)) },
        201,
      );
    })
    .patch("/announcements/:id", async (context) => {
      const input = updateAnnouncementRequestSchema.parse(await context.req.json());
      return context.json({
        data: await services.updateAnnouncement(context.req.param("id"), input, actorId(context)),
      });
    })
    .post("/announcements/:id/publish", async (context) => {
      await assertEmptyJsonBody(context.req.raw);
      return context.json({
        data: await services.setAnnouncementPublished(
          context.req.param("id"),
          true,
          actorId(context),
        ),
      });
    })
    .post("/announcements/:id/unpublish", async (context) => {
      await assertEmptyJsonBody(context.req.raw);
      return context.json({
        data: await services.setAnnouncementPublished(
          context.req.param("id"),
          false,
          actorId(context),
        ),
      });
    })
    .delete("/announcements/:id", async (context) => {
      return context.json({
        data: await services.deleteAnnouncement(context.req.param("id"), actorId(context)),
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
      return context.json({
        data: await services.updateWebhook(context.req.param("id"), input, actorId(context)),
      });
    })
    .delete("/webhooks/:id", async (context) => {
      return context.json({
        data: await services.deleteWebhook(context.req.param("id"), actorId(context)),
      });
    })
    .get("/webhook-event-types", async (context) => {
      return context.json({ data: await services.listWebhookEventTypes() });
    })
    .get("/webhook-deliveries", async (context) => {
      const query = listWebhookDeliveriesQuerySchema.parse(context.req.query());
      return context.json({ data: await services.listWebhookDeliveries(query) });
    })
    .get("/webhook-deliveries/:id", async (context) => {
      return context.json({ data: await services.getWebhookDelivery(context.req.param("id")) });
    });
}

function actorId(context: {
  get: (key: "authContext") => AuthContextVariables["authContext"];
}): string | null {
  return context.get("authContext")?.userId ?? null;
}
