import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAnnouncement,
  fetchAnnouncements,
  publishAnnouncement,
  unpublishAnnouncement,
  updateAnnouncement
} from "../src/features/notifications/announcement-api";
import {
  archiveNotification,
  deleteNotification,
  fetchInAppNotifications,
  markNotificationRead
} from "../src/features/notifications/in-app-notification-api";
import {
  createNotificationTemplate,
  fetchNotificationTemplates,
  updateNotificationTemplate
} from "../src/features/notifications/notification-template-api";
import {
  createWebhookSubscription,
  fetchWebhookSubscriptions,
  updateWebhookSubscription
} from "../src/features/notifications/webhook-subscription-api";
import {
  fetchProfile,
  updateOwnAvatar,
  updateOwnPreferences,
  updateOwnProfile
} from "../src/features/account/profile-api";
import {
  deleteFile,
  downloadFileBlob,
  fetchFileDetail,
  fetchFileReferences,
  fetchFiles,
  previewFileBlob,
  uploadFile
} from "../src/features/system/file-api";
import { fetchI18nMessages, updateI18nMessage } from "../src/features/system/i18n-message-api";
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

  it("loads and mutates announcements through the backend API", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "21",
                tenantId: null,
                title: "Maintenance",
                content: "Window",
                scopeType: "system",
                status: "draft",
                publishedAt: null,
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
      )
    );

    const records = await fetchAnnouncements();
    await createAnnouncement({ title: "Maintenance", content: "Window", scopeType: "system" });
    await updateAnnouncement("21", { title: "Maintenance updated" });
    await publishAnnouncement("21");
    await unpublishAnnouncement("21");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/announcements", {
      headers: { authorization: "Bearer token" }
    });
    expect(records).toEqual([
      expect.objectContaining({
        id: "21",
        title: "Maintenance",
        content: "Window",
        scopeType: "system",
        status: "draft"
      })
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/announcements", {
      method: "POST",
      body: JSON.stringify({ title: "Maintenance", content: "Window", scopeType: "system" }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json"
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/announcements/21", {
      method: "PATCH",
      body: JSON.stringify({ title: "Maintenance updated" }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json"
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/announcements/21/publish", {
      method: "POST",
      headers: { authorization: "Bearer token" }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(5, "/api/announcements/21/unpublish", {
      method: "POST",
      headers: { authorization: "Bearer token" }
    });
  });

  it("loads and updates in-app notifications through the backend API", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
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
      )
    );

    const records = await fetchInAppNotifications();
    await markNotificationRead("61");
    await archiveNotification("61");
    await deleteNotification("61");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/notifications", {
      headers: { authorization: "Bearer token" }
    });
    expect(records).toEqual([
      expect.objectContaining({
        id: "61",
        title: "Approval needed",
        status: "unread",
        metadata: { requestId: "REQ-1" }
      })
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/notifications/61/read", {
      method: "POST",
      headers: { authorization: "Bearer token" }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/notifications/61/archive", {
      method: "POST",
      headers: { authorization: "Bearer token" }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/notifications/61", {
      method: "DELETE",
      headers: { authorization: "Bearer token" }
    });
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

  it("loads notification templates from the backend API", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
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

    const records = await fetchNotificationTemplates();

    expect(fetchMock).toHaveBeenCalledWith("/api/notification-templates", {
      headers: { authorization: "Bearer token" }
    });
    expect(records).toEqual([
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
    ]);
  });

  it("loads and updates i18n messages through the backend API", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
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
      )
    );

    const records = await fetchI18nMessages();
    await updateI18nMessage("51", { messageValue: "Control center" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/i18n/messages", {
      headers: { authorization: "Bearer token" }
    });
    expect(records).toEqual([
      {
        id: "51",
        tenantId: null,
        messageKey: "routes.dashboard",
        language: "en",
        messageValue: "Dashboard",
        module: "routes",
        updatedAt: "2026-07-03T00:00:00.000Z"
      }
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/i18n/messages/51", {
      method: "PATCH",
      body: JSON.stringify({ messageValue: "Control center" }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json"
      }
    });
  });

  it("loads file metadata and invalidates files through the backend API", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/files/upload") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                id: "72",
                objectKey: "uploads/image.png",
                originalName: "image.png",
                contentType: "image/png",
                extension: "png",
                sizeBytes: 4,
                storageDriver: "local",
                status: "active",
                referenced: false,
                isDeleted: false,
                createdAt: "2026-07-03T00:00:00.000Z",
                updatedAt: "2026-07-03T00:00:00.000Z"
              }
            }),
            { status: 201, headers: { "content-type": "application/json" } }
          )
        );
      }
      if (url === "/api/files/71/references") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [
                {
                  id: "81",
                  fileObjectId: "71",
                  resourceType: "users",
                  resourceId: "1",
                  referenceType: "avatar",
                  status: "active",
                  createdAt: "2026-07-03T00:00:00.000Z",
                  createdBy: "1"
                }
              ]
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }
      if (url === "/api/files/71/download" || url === "/api/files/71/preview") {
        return Promise.resolve(new Response("file-bytes", { status: 200 }));
      }
      if (url === "/api/files" || url === "/api/files/71") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data:
                url === "/api/files"
                  ? [
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
                  : {
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
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          )
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ data: null }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      );
    });

    const records = await fetchFiles();
    const detail = await fetchFileDetail("71");
    await deleteFile("71");
    const uploaded = await uploadFile(new File(["png"], "image.png", { type: "image/png" }));
    const references = await fetchFileReferences("71");
    const downloaded = await downloadFileBlob("71");
    const preview = await previewFileBlob("71");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/files", {
      headers: { authorization: "Bearer token" }
    });
    expect(records).toEqual([
      expect.objectContaining({
        id: "71",
        originalName: "report.pdf",
        contentType: "application/pdf",
        referenced: true
      })
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/files/71", {
      headers: { authorization: "Bearer token" }
    });
    expect(detail).toEqual(expect.objectContaining({ id: "71", objectKey: "uploads/report.pdf" }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/files/71", {
      method: "DELETE",
      headers: { authorization: "Bearer token" }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/files/upload", {
      method: "POST",
      body: expect.any(FormData),
      headers: { authorization: "Bearer token" }
    });
    expect(uploaded).toEqual(expect.objectContaining({ id: "72", originalName: "image.png" }));
    expect(fetchMock).toHaveBeenNthCalledWith(5, "/api/files/71/references", {
      headers: { authorization: "Bearer token" }
    });
    expect(references).toEqual([
      expect.objectContaining({ id: "81", resourceType: "users", referenceType: "avatar" })
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(6, "/api/files/71/download", {
      headers: { authorization: "Bearer token" }
    });
    await expect(downloaded.text()).resolves.toBe("file-bytes");
    expect(fetchMock).toHaveBeenNthCalledWith(7, "/api/files/71/preview", {
      headers: { authorization: "Bearer token" }
    });
    await expect(preview.text()).resolves.toBe("file-bytes");
  });

  it("creates and updates notification templates through the backend API", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: { id: "41" } }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );

    await createNotificationTemplate({
      code: "welcome",
      channel: "in_app",
      locale: "en",
      subject: "Welcome",
      body: "Hello {{userName}}",
      variables: ["userName"]
    });
    await updateNotificationTemplate("41", { subject: "Welcome back" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/notification-templates", {
      method: "POST",
      body: JSON.stringify({
        code: "welcome",
        channel: "in_app",
        locale: "en",
        subject: "Welcome",
        body: "Hello {{userName}}",
        variables: ["userName"]
      }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json"
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/notification-templates/41", {
      method: "PATCH",
      body: JSON.stringify({ subject: "Welcome back" }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json"
      }
    });
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

  it("loads and updates the current profile through the backend API", async () => {
    localStorage.setItem("web-admin.access-token", "token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            data: {
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
                language: "zh",
                themeMode: "dark",
                themeColor: "emerald",
                pageTabsEnabled: false,
                updatedAt: "2026-07-03T00:00:00.000Z"
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    const profile = await fetchProfile();
    await updateOwnProfile({ displayName: "Admin User" });
    await updateOwnPreferences({ language: "en", themeMode: "light", themeColor: "blue", pageTabsEnabled: true });
    await updateOwnAvatar({ avatarFileId: "9" });

    expect(profile.preferences).toMatchObject({
      language: "zh",
      themeMode: "dark",
      themeColor: "emerald",
      pageTabsEnabled: false
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/profile", {
      headers: { authorization: "Bearer token" }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Admin User" }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json"
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/profile/preferences", {
      method: "PATCH",
      body: JSON.stringify({
        language: "en",
        themeMode: "light",
        themeColor: "blue",
        pageTabsEnabled: true
      }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json"
      }
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/profile/avatar", {
      method: "POST",
      body: JSON.stringify({ avatarFileId: "9" }),
      headers: {
        authorization: "Bearer token",
        "content-type": "application/json"
      }
    });
  });
});
