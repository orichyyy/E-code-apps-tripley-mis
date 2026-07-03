import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPageDataset } from "../src/lib/api-client";

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
});
