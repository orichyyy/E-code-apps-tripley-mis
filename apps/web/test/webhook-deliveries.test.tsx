import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WebhookDeliveriesPanel } from "../src/features/notifications/webhook-deliveries-panel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("webhook delivery history", () => {
  it("renders safe delivery history and attempt details from real API responses", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/webhooks") return response({ data: [{ id: "31", name: "Audit" }] });
      if (url === "/api/webhook-event-types") {
        return response({ data: [{ type: "user.created", description: "User created" }] });
      }
      if (url === "/api/webhook-deliveries/91") {
        return response({
          data: {
            ...delivery(),
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
        });
      }
      return response({ data: { items: [delivery()], page: 1, pageSize: 20, total: 1 } });
    });

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <WebhookDeliveriesPanel />
      </QueryClientProvider>,
    );

    const eventCell = await screen.findByRole("cell", { name: "user.created" });
    expect(eventCell).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.queryByText(/private|token|raw-secret/i)).not.toBeInTheDocument();

    fireEvent.click(eventCell);
    expect(await screen.findByText("Attempt 1")).toBeInTheDocument();
    expect(screen.getByText("HTTP 503 · 1000 ms")).toBeInTheDocument();
  });
});

function delivery() {
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
    lastErrorMessage: "HTTP failure",
    succeededAt: null,
    failedAt: "2026-07-17T01:00:01.000Z",
    canceledAt: null,
    createdAt: "2026-07-17T01:00:00.000Z",
    updatedAt: "2026-07-17T01:00:01.000Z",
  };
}

function response(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
}
