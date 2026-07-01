import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

describe("api health route", () => {
  it("responds at /api/health with a request id", async () => {
    const app = createApp();
    const response = await app.request("/api/health", {
      headers: {
        "x-request-id": "test-request-123"
      }
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("test-request-123");
    expect(body).toMatchObject({
      status: "ok",
      service: "api",
      requestId: "test-request-123"
    });
  });
});
