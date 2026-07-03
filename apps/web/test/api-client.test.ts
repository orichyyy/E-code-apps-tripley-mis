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
});
