import { describe, expect, it } from "vitest";
import { baseApiPermissionManifest } from "@web-admin-base/contracts";

import { createApp, createDefaultAppDependencies } from "../src/app";

describe("api health route", () => {
  it("responds at /api/health with a request id", async () => {
    const app = createApp();
    const response = await app.request("/api/health", {
      headers: {
        "x-request-id": "test-request-123",
      },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("test-request-123");
    expect(body).toMatchObject({
      status: "ok",
      service: "api",
      requestId: "test-request-123",
    });
  });

  it("exposes the reserved metrics endpoint with a request id", async () => {
    const app = createApp();
    const response = await app.request("/api/metrics", {
      headers: {
        "x-request-id": "metrics-request-123",
      },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("metrics-request-123");
    expect(body).toMatchObject({
      data: {
        status: "reserved",
        service: "api",
        requestId: "metrics-request-123",
      },
    });
  });

  it("serves OpenAPI documentation for implemented API routes", async () => {
    const app = createApp();
    const response = await app.request("/api/openapi.json");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.openapi).toBe("3.1.0");
    const operationCount = Object.values(body.paths).reduce(
      (count: number, methods) => count + Object.keys(methods as object).length,
      0,
    );

    expect(operationCount).toBe(baseApiPermissionManifest.length);
    expect(body.paths["/auth/login"].post).toMatchObject({
      "x-permission-code": "api.auth.login",
      "x-public": true,
    });
  });

  it("writes structured access logs with request IDs", async () => {
    const entries: unknown[] = [];
    const app = createApp({
      ...createDefaultAppDependencies(),
      structuredLogSink: {
        write(entry) {
          entries.push(entry);
        },
      },
    });

    const response = await app.request("/api/health", {
      headers: { "x-request-id": "log-request-123" },
    });

    expect(response.status).toBe(200);
    expect(entries).toContainEqual(
      expect.objectContaining({
        event: "http_request",
        requestId: "log-request-123",
        method: "GET",
        path: "/api/health",
        status: 200,
      }),
    );
  });
});
