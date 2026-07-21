import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmailDeliveriesPage } from "../src/features/notifications/email-deliveries-page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("email delivery history", () => {
  it("renders masked recipients and safe attempt details without sensitive content", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (String(input) === "/api/email-deliveries/41") {
        return response({
          data: {
            ...delivery(),
            lastSmtpCode: 451,
            lastErrorCode: "SMTP_TRANSIENT_RESPONSE",
            lastErrorMessage: "SMTP_TRANSIENT_RESPONSE (451)",
            referenceType: null,
            referenceId: null,
            attempts: [
              {
                id: "51",
                attemptNumber: 1,
                status: "failed",
                durationMs: 250,
                smtpCode: 451,
                errorCode: "SMTP_TRANSIENT_RESPONSE",
                errorMessage: "SMTP_TRANSIENT_RESPONSE (451)",
                finishedAt: "2026-07-17T01:00:01.000Z",
              },
            ],
          },
        });
      }
      return response({ data: { items: [delivery()], total: 1, page: 1, pageSize: 20 } });
    });

    renderPage();

    const recipient = await screen.findByRole("cell", { name: "a***e@example.com" });
    expect(recipient).toBeInTheDocument();
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("Secret subject or body")).not.toBeInTheDocument();

    fireEvent.click(recipient);
    expect(await screen.findByText("SMTP 451 · 250 ms")).toBeInTheDocument();
    expect(screen.getAllByText(/SMTP_TRANSIENT_RESPONSE/).length).toBeGreaterThan(0);
  });

  it("sends locale and creation-range filters to the API", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(await response({ data: { items: [], total: 0, page: 1, pageSize: 20 } }));
    renderPage();

    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "zh" } });
    fireEvent.change(screen.getByLabelText("Created from"), {
      target: { value: "2026-07-17T09:30" },
    });

    const expectedFrom = encodeURIComponent(new Date("2026-07-17T09:30").toISOString());
    await vi.waitFor(() => {
      expect(
        fetch.mock.calls.some(([url]) => {
          const value = String(url);
          return value.includes("locale=zh") && value.includes(`from=${expectedFrom}`);
        }),
      ).toBe(true);
    });
  });
});

function renderPage() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <EmailDeliveriesPage
        route={{
          routeCode: "notifications.email-deliveries",
          path: "/notifications/email-deliveries",
          titleI18nKey: "routes.notifications.emailDeliveries",
          menuVisible: true,
          sortOrder: 225,
        }}
      />
    </QueryClientProvider>,
  );
}

function delivery() {
  return {
    id: "41",
    requestKey: "account:41",
    userId: "7",
    templateId: "5",
    templateCode: "account.notice",
    locale: "en",
    maskedRecipient: "a***e@example.com",
    status: "pending",
    attempt: 1,
    maxAttempts: 5,
    createdAt: "2026-07-17T01:00:00.000Z",
    updatedAt: "2026-07-17T01:00:00.000Z",
    succeededAt: null,
    failedAt: null,
    canceledAt: null,
    contentPurgedAt: null,
    rawRecipient: "alice@example.com",
    subject: "Secret subject or body",
    contentEnvelope: "encrypted-secret",
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
