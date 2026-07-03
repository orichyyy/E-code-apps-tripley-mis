import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/app/App";
import { queryClient } from "../src/queries/query-client";
import { useAuthStore } from "../src/stores/auth.store";
import { useLayoutStore } from "../src/stores/layout.store";

describe("web admin frontend", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
    useAuthStore.getState().signOut();
    useLayoutStore.setState({
      pageTabsEnabled: true,
      darkModeEnabled: false,
      fullscreenEnabled: false,
      themeColor: "blue",
      openTabs: ["/"],
      language: "en"
    });
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
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const method = init?.method ?? "GET";
      const body = method === "PATCH"
        ? {
            data: {
              id: "1",
              tenantId: null,
              userId: "1",
              language: "zh",
              themeMode: "dark",
              themeColor: "emerald",
              pageTabsEnabled: false,
              updatedAt: "2026-07-03T00:00:01.000Z"
            }
          }
        : { data: profileFixture() };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );
    });
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
    expect(await screen.findByText("Theme color")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "zh" } });
    fireEvent.click(screen.getByRole("button", { name: /emerald/i }));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/profile/preferences", {
        method: "PATCH",
        body: JSON.stringify({
          language: "zh",
          themeMode: "light",
          themeColor: "emerald",
          pageTabsEnabled: true
        }),
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json"
        }
      });
    });
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

  it("renders in-app notifications from the backend API", async () => {
    window.history.pushState(null, "", "/notifications/in-app");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "61",
              userId: "1",
              channel: "in_app",
              title: "Approval needed",
              body: "Review pending request",
              status: "unread",
              metadata: { requestId: "REQ-1" },
              readAt: null,
              archivedAt: null,
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
      permissionCodes: ["notification:view", "notification:update"]
    });

    render(<App />);

    expect(await screen.findByText("Approval needed")).toBeInTheDocument();
    expect(screen.getByText("Review pending request")).toBeInTheDocument();
    expect(screen.getByText("requestId: REQ-1")).toBeInTheDocument();
    expect(screen.getAllByText("In-app notifications").length).toBeGreaterThan(0);
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

  it("renders file metadata from the backend API", async () => {
    window.history.pushState(null, "", "/system/files");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "71",
              objectKey: "uploads/report.pdf",
              originalName: "report.pdf",
              contentType: "application/pdf",
              extension: "pdf",
              sizeBytes: 2048,
              storageDriver: "local",
              status: "active",
              referenced: true,
              isDeleted: false,
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
      permissionCodes: ["file:view", "file:upload", "file:download", "file:preview", "file:references:view", "file:delete"]
    });

    render(<App />);

    expect(await screen.findByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("application/pdf")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    expect(screen.getByText("Referenced")).toBeInTheDocument();
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Download")).toBeInTheDocument();
    expect(screen.getAllByText("File management").length).toBeGreaterThan(0);
  });
});

function profileFixture() {
  return {
    user: {
      id: "1",
      username: "admin",
      displayName: "Super Administrator",
      email: "admin@example.com",
      phone: "10000000000",
      avatarFileId: null,
      gender: null,
      employeeNumber: null
    },
    preferences: {
      id: "1",
      tenantId: null,
      userId: "1",
      language: "en",
      themeMode: "light",
      themeColor: "blue",
      pageTabsEnabled: true,
      updatedAt: "2026-07-03T00:00:00.000Z"
    }
  };
}
