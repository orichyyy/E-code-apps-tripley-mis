import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/app/App";
import { queryClient } from "../src/queries/query-client";
import { useAuthStore } from "../src/stores/auth.store";
import { useLayoutStore } from "../src/stores/layout.store";

describe("web admin frontend", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    queryClient.clear();
    act(() => {
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
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
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
        })
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
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
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
        })
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
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
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
        })
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
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
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
        })
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
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
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
        })
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
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
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
        })
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

  it("renders core user management with backend records", async () => {
    window.history.pushState(null, "", "/system/users");
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/users")) {
        return Promise.resolve(
          jsonResponse({
            data: {
              items: [
                {
                  id: "1",
                  username: "admin",
                  displayName: "Super Administrator",
                  email: "admin@example.com",
                  phone: "10000000000",
                  status: "enabled",
                  updatedAt: "2026-07-03T00:00:00.000Z"
                }
              ]
            }
          })
        );
      }
      if (url === "/api/organizations/tree") {
        return Promise.resolve(jsonResponse({ data: [{ id: "1", name: "Main Organization", code: "main" }] }));
      }
      if (url.startsWith("/api/roles")) {
        return Promise.resolve(jsonResponse({ data: { items: [{ id: "1", name: "Super Admin", code: "super_admin" }] } }));
      }
      return Promise.resolve(jsonResponse({ data: [] }));
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
      permissionCodes: ["user:view", "user:create", "user:update", "user:delete"]
    });

    render(<App />);

    expect(await screen.findByText("Super Administrator")).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create/i })).toBeInTheDocument();
    expect(screen.getAllByText("User management").length).toBeGreaterThan(0);
  });

  it("renders system configuration with editable typed values", async () => {
    window.history.pushState(null, "", "/system/config");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/system-config") {
        return Promise.resolve(
          jsonResponse({
            data: [
              {
                id: "11",
                tenantId: null,
                configKey: "password.minimumLength",
                configValue: 8,
                valueType: "number",
                groupKey: "password",
                description: "Minimum password length",
                editable: true,
                status: "enabled",
                updatedAt: "2026-07-03T00:00:00.000Z"
              }
            ]
          })
        );
      }
      return Promise.resolve(jsonResponse({ data: { id: "11" } }));
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
      permissionCodes: ["system-config:view", "system-config:update"]
    });

    render(<App />);

    expect(await screen.findByText("password.minimumLength")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/system-config/password.minimumLength", {
        method: "PATCH",
        body: JSON.stringify({ configValue: 10 }),
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json"
        }
      });
    });
  });

  it("renders dictionaries and creates dictionary items", async () => {
    window.history.pushState(null, "", "/system/dictionaries");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/dictionary-types") {
        return Promise.resolve(
          jsonResponse({
            data: [
              {
                id: "21",
                tenantId: null,
                code: "status",
                name: "Status",
                description: "Base status values",
                status: "enabled"
              }
            ]
          })
        );
      }
      if (url === "/api/dictionary-types/21/items") {
        return Promise.resolve(
          jsonResponse({
            data: [
              {
                id: "31",
                tenantId: null,
                typeId: "21",
                itemValue: "enabled",
                labelI18nKey: "dictionary.status.enabled",
                sortOrder: 1,
                status: "enabled"
              }
            ]
          })
        );
      }
      return Promise.resolve(jsonResponse({ data: { id: "32" } }));
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
      permissionCodes: ["dictionary:view", "dictionary:create", "dictionary:update"]
    });

    render(<App />);

    expect(await screen.findByText("Status")).toBeInTheDocument();
    expect(await screen.findByText("dictionary.status.enabled")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^item$/i }));
    fireEvent.change(screen.getByLabelText("Item value"), { target: { value: "disabled" } });
    fireEvent.change(screen.getByLabelText("Label i18n key"), { target: { value: "dictionary.status.disabled" } });
    fireEvent.change(screen.getByLabelText("Sort order"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/dictionary-types/21/items", {
        method: "POST",
        body: JSON.stringify({
          itemValue: "disabled",
          labelI18nKey: "dictionary.status.disabled",
          sortOrder: 2,
          status: "enabled"
        }),
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json"
        }
      });
    });
  });

  it("renders operation pages with real API-backed records", async () => {
    window.history.pushState(null, "", "/operations/scheduler");
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/scheduled-tasks") {
        return Promise.resolve(
          jsonResponse({
            data: [
              {
                id: "7",
                code: "log-retention",
                cronExpression: "0 2 * * *",
                handlerType: "logs.retention",
                payload: {},
                enabled: true,
                status: "enabled",
                nextRunAt: "2026-07-04T02:00:00.000Z",
                attempt: 0,
                maxAttempts: 3,
                createdAt: "2026-07-03T00:00:00.000Z",
                updatedAt: "2026-07-03T00:00:00.000Z"
              }
            ]
          })
        );
      }
      return Promise.resolve(jsonResponse({ data: [] }));
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
      permissionCodes: ["job:view", "job:create", "job:update", "job:run"]
    });

    render(<App />);

    expect(await screen.findByText("log-retention")).toBeInTheDocument();
    expect(screen.getByText("logs.retention")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run/i })).toBeInTheDocument();
  });

  it("renders log pages and creates async export tasks", async () => {
    window.history.pushState(null, "", "/logs/login");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/logs/login") {
        return Promise.resolve(
          jsonResponse({
            data: [
              {
                id: "91",
                logType: "login",
                level: "info",
                message: "Login succeeded",
                traceId: "trace-1",
                userId: "1",
                ipAddress: "127.0.0.1",
                metadata: { username: "admin" },
                occurredAt: "2026-07-03T00:00:00.000Z",
                createdAt: "2026-07-03T00:00:00.000Z"
              }
            ]
          })
        );
      }
      return Promise.resolve(jsonResponse({ data: { id: "101", taskType: "export", resourceType: "logs:login", status: "pending" } }));
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
      permissionCodes: ["login-log:view", "log:export"]
    });

    render(<App />);

    expect(await screen.findByText("Login succeeded")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/logs/export", {
        method: "POST",
        body: JSON.stringify({ logType: "login" }),
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json"
        }
      });
    });
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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
