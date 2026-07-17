import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deleteWebhookSubscription,
  fetchWebhookEventTypes,
} from "../src/features/notifications/webhook-subscription-api";
import {
  fetchWebhookDeliveries,
  fetchWebhookDelivery,
} from "../src/features/notifications/webhook-delivery-api";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("webhook frontend API", () => {
  it("loads filtered delivery history and safe attempt details", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ data: { items: [deliveryRecord()], total: 1 } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            ...deliveryRecord(),
            attempts: [
              {
                id: "101",
                attemptNumber: 1,
                status: "failed",
                startedAt: "2026-07-17T01:00:00.000Z",
                finishedAt: "2026-07-17T01:00:01.000Z",
                durationMs: 1000,
                httpStatus: 503,
                errorCode: "HTTP_503",
                errorMessage: "Webhook receiver returned HTTP 503.",
              },
            ],
          },
        }),
      );

    const deliveries = await fetchWebhookDeliveries({
      subscriptionId: "31",
      eventType: "user.created",
      status: "failed",
      from: "2026-07-17T08:00",
      to: "2026-07-17T09:00",
    });
    const detail = await fetchWebhookDelivery("91");

    const firstUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(firstUrl).toContain("/api/webhook-deliveries?");
    expect(firstUrl).toContain("subscriptionId=31");
    expect(firstUrl).toContain("eventType=user.created");
    expect(firstUrl).toContain("status=failed");
    expect(deliveries.items[0]).toMatchObject({ id: "91", targetHost: "example.com" });
    expect(detail.attempts[0]).toMatchObject({ id: "101", httpStatus: 503 });
    expect(JSON.stringify([deliveries, detail])).not.toContain("secret");
  });

  it("loads the controlled event catalog and soft-deletes subscriptions", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            { type: "user.created", description: "A user was created." },
            { type: "not.allowed", description: "Rejected by the client boundary." },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { id: "31", isDeleted: true } }));

    await expect(fetchWebhookEventTypes()).resolves.toEqual([
      { type: "user.created", description: "A user was created." },
    ]);
    await deleteWebhookSubscription("31");

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/webhooks/31", {
      method: "DELETE",
      headers: { authorization: "Bearer token" },
    });
  });
});

function deliveryRecord() {
  return {
    id: "91",
    eventId: "81",
    subscriptionId: "31",
    eventType: "user.created",
    targetHost: "example.com",
    status: "failed",
    attempt: 1,
    maxAttempts: 5,
    nextAttemptAt: "2026-07-17T01:01:00.000Z",
    lastHttpStatus: 503,
    lastErrorCode: "HTTP_503",
    lastErrorMessage: "Webhook receiver returned HTTP 503.",
    succeededAt: null,
    failedAt: "2026-07-17T01:00:01.000Z",
    canceledAt: null,
    createdAt: "2026-07-17T01:00:00.000Z",
    updatedAt: "2026-07-17T01:00:01.000Z",
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
