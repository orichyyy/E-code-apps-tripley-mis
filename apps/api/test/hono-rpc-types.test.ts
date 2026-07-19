import { expect, it } from "vitest";
import { hc } from "hono/client";

import type { ApiApp } from "../src/app";

it("keeps Hono RPC type inference available for permission extension routes", () => {
  const client = hc<ApiApp>("/");

  const getRoleDataPermissions = client.api.roles[":id"]["data-permissions"].$get;
  const updateRoleDataPermissions = client.api.roles[":id"]["data-permissions"].$put;
  const getRoleFieldPermissions = client.api.roles[":id"]["field-permissions"].$get;
  const updateRoleFieldPermissions = client.api.roles[":id"]["field-permissions"].$put;
  const getUserOverrides = client.api.permissions["user-overrides"][":userId"].$get;
  const updateUserOverrides = client.api.permissions["user-overrides"][":userId"].$put;

  expect(getRoleDataPermissions).toBeDefined();
  expect(updateRoleDataPermissions).toBeDefined();
  expect(getRoleFieldPermissions).toBeDefined();
  expect(updateRoleFieldPermissions).toBeDefined();
  expect(getUserOverrides).toBeDefined();
  expect(updateUserOverrides).toBeDefined();
  expect(client).toBeDefined();
});

it("keeps Hono RPC type inference available for communications routes", () => {
  const client = hc<ApiApp>("/");

  const listAnnouncements = client.api.announcements.$get;
  const createAnnouncement = client.api.announcements.$post;
  const listCurrentAnnouncements = client.api.announcements.current.$get;
  const updateAnnouncement = client.api.announcements[":id"].$patch;
  const deleteAnnouncement = client.api.announcements[":id"].$delete;
  const publishAnnouncement = client.api.announcements[":id"].publish.$post;
  const unpublishAnnouncement = client.api.announcements[":id"].unpublish.$post;
  const listWebhooks = client.api.webhooks.$get;
  const createWebhook = client.api.webhooks.$post;
  const updateWebhook = client.api.webhooks[":id"].$patch;
  const deleteWebhook = client.api.webhooks[":id"].$delete;
  const listWebhookEventTypes = client.api["webhook-event-types"].$get;
  const listWebhookDeliveries = client.api["webhook-deliveries"].$get;
  const getWebhookDelivery = client.api["webhook-deliveries"][":id"].$get;

  expect(listAnnouncements).toBeDefined();
  expect(createAnnouncement).toBeDefined();
  expect(listCurrentAnnouncements).toBeDefined();
  expect(updateAnnouncement).toBeDefined();
  expect(deleteAnnouncement).toBeDefined();
  expect(publishAnnouncement).toBeDefined();
  expect(unpublishAnnouncement).toBeDefined();
  expect(listWebhooks).toBeDefined();
  expect(createWebhook).toBeDefined();
  expect(updateWebhook).toBeDefined();
  expect(deleteWebhook).toBeDefined();
  expect(listWebhookEventTypes).toBeDefined();
  expect(listWebhookDeliveries).toBeDefined();
  expect(getWebhookDelivery).toBeDefined();
});
