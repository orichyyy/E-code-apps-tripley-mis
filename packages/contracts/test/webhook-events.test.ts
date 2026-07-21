import { describe, expect, it } from "vitest";

import {
  createCloudEventEnvelope,
  createWebhookEventCatalog,
  normalizeBusinessModuleDefinition,
  webhookEventCatalog,
  webhookOutboxEventSchema,
} from "../src";

describe("webhook event contracts", () => {
  it("keeps the external event catalog controlled", () => {
    expect(webhookEventCatalog.map((event) => event.type)).toEqual([
      "user.created",
      "job.failed",
      "permission.changed",
      "notification.requested",
    ]);
  });

  it("rejects undeclared fields and creates a stable CloudEvents envelope", () => {
    const event = webhookOutboxEventSchema.parse({
      type: "user.created",
      subject: "users/42",
      occurredAt: "2026-07-17T01:02:03.000Z",
      data: { userId: "42", primaryOrganizationId: "3", createdByUserId: "1" },
    });

    expect(createCloudEventEnvelope("9", "admin.test", event)).toEqual({
      specversion: "1.0",
      id: "9",
      type: "user.created",
      source: "admin.test",
      time: "2026-07-17T01:02:03.000Z",
      subject: "users/42",
      datacontenttype: "application/json",
      data: { userId: "42", primaryOrganizationId: "3", createdByUserId: "1" },
    });
    expect(() => webhookOutboxEventSchema.parse({ ...event, token: "secret" })).toThrow();
  });

  it("adds only explicitly supplied module events to the controlled catalog", () => {
    const module = normalizeBusinessModuleDefinition({
      contractVersion: 1,
      moduleCode: "fixture-events",
      defaultLocale: "en",
      title: { key: "fixture.title", defaultMessage: "Fixture events" },
      contributions: {
        domainEvents: [
          {
            eventType: "fixture-events.changed",
            title: { key: "fixture.changed", defaultMessage: "Fixture changed" },
            payloadSchemaId: "ChangedPayload",
          },
        ],
        notificationEvents: [
          {
            eventType: "fixture-events.notice",
            title: { key: "fixture.notice", defaultMessage: "Fixture notice" },
            payloadSchemaId: "NoticePayload",
            channels: ["webhook"],
            templateCodes: { webhook: "fixture-events.notice" },
          },
        ],
      },
    });

    expect(createWebhookEventCatalog([module])).toEqual(
      expect.arrayContaining([
        { type: "fixture-events.changed", description: "Fixture changed" },
        { type: "fixture-events.notice", description: "Fixture notice" },
      ]),
    );
    expect(createWebhookEventCatalog([])).toHaveLength(webhookEventCatalog.length);
  });
});
