import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/app/App";
import { useAuthStore } from "../src/stores/auth.store";

describe("web admin frontend", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the login page", async () => {
    window.history.pushState(null, "", "/login");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("renders the authenticated admin shell", async () => {
    window.history.pushState(null, "", "/");
    useAuthStore.getState().signIn({
      accessToken: "test-token",
      user: {
        id: "1",
        username: "admin",
        displayName: "Super Administrator",
        language: "en",
        forcePasswordChange: false
      },
      permissionCodes: ["*"]
    });

    render(<App />);

    expect(await screen.findByText("Web Admin Base")).toBeInTheDocument();
    expect(await screen.findByText("User management")).toBeInTheDocument();
    expect(await screen.findByLabelText("Current organization")).toBeInTheDocument();
  });

  it("renders personal settings with tab and theme controls", async () => {
    window.history.pushState(null, "", "/account/settings");
    useAuthStore.getState().signIn({
      accessToken: "test-token",
      user: {
        id: "1",
        username: "admin",
        displayName: "Super Administrator",
        language: "en",
        forcePasswordChange: false
      },
      permissionCodes: ["*"]
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Personal settings" })).toBeInTheDocument();
    expect(screen.getByText("Theme color")).toBeInTheDocument();
  });

  it("renders webhook subscriptions without displaying raw secrets", async () => {
    window.history.pushState(null, "", "/notifications/webhooks");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
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
    useAuthStore.getState().signIn({
      accessToken: "test-token",
      user: {
        id: "1",
        username: "admin",
        displayName: "Super Administrator",
        language: "en",
        forcePasswordChange: false
      },
      permissionCodes: ["webhook:view", "webhook:create", "webhook:update"]
    });

    render(<App />);

    expect(await screen.findByText("Audit webhook")).toBeInTheDocument();
    expect(screen.getByText("Configured")).toBeInTheDocument();
    expect(screen.queryByText("raw-secret")).not.toBeInTheDocument();
  });

  it("renders announcements from the backend API", async () => {
    window.history.pushState(null, "", "/notifications/announcements");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "21",
              tenantId: null,
              title: "Maintenance",
              content: "Planned window",
              scopeType: "system",
              status: "published",
              publishedAt: "2026-07-03T00:00:00.000Z",
              isDeleted: false,
              deletedAt: null,
              deletedBy: null,
              createdAt: "2026-07-03T00:00:00.000Z",
              updatedAt: "2026-07-03T00:00:00.000Z",
              createdBy: "1",
              updatedBy: "1"
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    useAuthStore.getState().signIn({
      accessToken: "test-token",
      user: {
        id: "1",
        username: "admin",
        displayName: "Super Administrator",
        language: "en",
        forcePasswordChange: false
      },
      permissionCodes: ["announcement:view", "announcement:create", "announcement:update", "announcement:publish"]
    });

    render(<App />);

    expect(await screen.findByText("Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Planned window")).toBeInTheDocument();
    expect(screen.getAllByText("Announcements").length).toBeGreaterThan(0);
  });

  it("renders notification templates from the backend API", async () => {
    window.history.pushState(null, "", "/notifications/templates");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "41",
              code: "welcome",
              channel: "in_app",
              locale: "en",
              subject: "Welcome",
              body: "Hello {{userName}}",
              variables: ["userName"],
              status: "enabled",
              createdAt: "2026-07-03T00:00:00.000Z",
              updatedAt: "2026-07-03T00:00:00.000Z"
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    useAuthStore.getState().signIn({
      accessToken: "test-token",
      user: {
        id: "1",
        username: "admin",
        displayName: "Super Administrator",
        language: "en",
        forcePasswordChange: false
      },
      permissionCodes: ["notification-template:view", "notification-template:create", "notification-template:update"]
    });

    render(<App />);

    expect(await screen.findByText("welcome")).toBeInTheDocument();
    expect(screen.getByText("userName")).toBeInTheDocument();
    expect(screen.getAllByText("Notification templates").length).toBeGreaterThan(0);
  });

  it("renders i18n messages from the backend API", async () => {
    window.history.pushState(null, "", "/system/i18n-messages");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "51",
              tenantId: null,
              messageKey: "routes.dashboard",
              language: "en",
              messageValue: "Dashboard",
              module: "routes",
              updatedAt: "2026-07-03T00:00:00.000Z"
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    useAuthStore.getState().signIn({
      accessToken: "test-token",
      user: {
        id: "1",
        username: "admin",
        displayName: "Super Administrator",
        language: "en",
        forcePasswordChange: false
      },
      permissionCodes: ["i18n:view", "i18n:update"]
    });

    render(<App />);

    expect(await screen.findByText("routes.dashboard")).toBeInTheDocument();
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("i18n messages").length).toBeGreaterThan(0);
  });
});
