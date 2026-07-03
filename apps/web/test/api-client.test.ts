import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createWebhookSubscription,
  fetchPageDataset,
  fetchWebhookSubscriptions,
  updateWebhookSubscription
} from "../src/lib/api-client";

describe("frontend API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("loads available infrastructure pages from the backend API", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "7",
              code: "cleanup",
              handlerType: "cleanup",
              status: "enabled",
              updatedAt: "2026-07-03T00:00:00.000Z"
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const dataset = await fetchPageDataset("operations.scheduler");

    expect(fetchMock).toHaveBeenCalledWith("/api/scheduled-tasks", {
      headers: { authorization: "Bearer token" }
    });
    expect(dataset.mode).toBe("available-api");
    expect(dataset.records).toEqual([
      expect.objectContaining({
        id: "7",
        name: "cleanup",
        code: "cleanup",
        owner: "cleanup",
        source: "available-api"
      })
    ]);
  });

  it("loads system configuration pages from the backend API", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "11",
              configKey: "password.minimumLength",
              configValue: 8,
              valueType: "number",
              groupKey: "password",
              status: "enabled",
              updatedAt: "2026-07-03T00:00:00.000Z"
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const dataset = await fetchPageDataset("system.config");

    expect(fetchMock).toHaveBeenCalledWith("/api/system-config", {
      headers: { authorization: "Bearer token" }
    });
    expect(dataset.records).toEqual([
      expect.objectContaining({
        id: "11",
        name: "password.minimumLength",
        code: "password.minimumLength",
        source: "available-api"
      })
    ]);
  });

  it("loads announcement pages from the backend API", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "21",
              title: "Maintenance",
              content: "Window",
              scopeType: "system",
              status: "published",
              updatedAt: "2026-07-03T00:00:00.000Z"
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const dataset = await fetchPageDataset("notifications.announcements");

    expect(fetchMock).toHaveBeenCalledWith("/api/announcements", {
      headers: { authorization: "Bearer token" }
    });
    expect(dataset.records).toEqual([
      expect.objectContaining({
        id: "21",
        name: "Maintenance",
        status: "published",
        source: "available-api"
      })
    ]);
  });

  it("loads webhook subscriptions without exposing raw secrets", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "31",
              name: "Audit webhook",
              url: "https://example.com/audit",
              eventTypes: ["security.event"],
              secret: "raw-secret",
              secretConfigured: true,
              status: "enabled",
              createdAt: "2026-07-03T00:00:00.000Z",
              updatedAt: "2026-07-03T00:00:00.000Z"
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const records = await fetchWebhookSubscriptions();

    expect(fetchMock).toHaveBeenCalledWith("/api/webhooks", {
      headers: { authorization: "Bearer token" }
    });
    expect(records).toEqual([
      {
        id: "31",
        name: "Audit webhook",
        url: "https://example.com/audit",
        eventTypes: ["security.event"],
        secretConfigured: true,
        status: "enabled",
        createdAt: "2026-07-03T00:00:00.000Z",
        updatedAt: "2026-07-03T00:00:00.000Z"
      }
    ]);
    expect(records[0]).not.toHaveProperty("secret");
  });

  it("creates and updates webhook subscriptions through the backend API", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { id: "31" } }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );

    await createWebhookSubscription({
      name: "Audit webhook",
      url: "https://example.com/audit",
      eventTypes: ["security.event"],
      secret: "new-secret",
      status: "enabled"
    });
    await updateWebhookSubscription("31", { status: "disabled" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/webhooks", {
      method: "POST",
      body: JSON.stringify({
        name: "Audit webhook",
        url: "https://example.com/audit",
        eventTypes: ["security.event"],
        secret: "new-secret",
        status: "enabled"
      }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json"
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/webhooks/31", {
      method: "PATCH",
      body: JSON.stringify({ status: "disabled" }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json"
      }
    });
  });
});
