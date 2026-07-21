import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

describe("organization-scoped announcement routes", () => {
  it("enforces minimal targets, draft lifecycle, and current-organization visibility", async () => {
    const app = createApp();
    await initialize(app);
    let headers = await loginHeaders(app);
    const childId = await createOrganization(app, headers, {
      name: "Operations",
      code: "operations",
      parentOrganizationId: "1",
    });
    const grandchildId = await createOrganization(app, headers, {
      name: "East Operations",
      code: "operations-east",
      parentOrganizationId: childId,
    });
    const validationTargetId = await createOrganization(app, headers, {
      name: "Validation Target",
      code: "validation-target",
      parentOrganizationId: "1",
    });

    const redundant = await app.request("/api/announcements", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Redundant",
        content: "Invalid targets",
        scopeType: "organization",
        targetOrganizationIds: ["1", childId],
      }),
    });
    expect(redundant.status).toBe(400);

    const publishRevalidation = await createAnnouncement(app, headers, {
      title: "Publish revalidation",
      content: "Target state must be checked again",
      scopeType: "organization",
      targetOrganizationIds: [validationTargetId],
    });
    await setOrganizationStatus(app, headers, validationTargetId, "disable");
    const disabledTargetCreate = await app.request("/api/announcements", {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "Disabled target",
        content: "Invalid target",
        scopeType: "organization",
        targetOrganizationIds: [validationTargetId],
      }),
    });
    const disabledTargetPublish = await app.request(
      `/api/announcements/${publishRevalidation.id}/publish`,
      { method: "POST", headers },
    );
    expect(disabledTargetCreate.status).toBe(400);
    expect(disabledTargetPublish.status).toBe(400);
    await setOrganizationStatus(app, headers, validationTargetId, "enable");

    const expired = await createAnnouncement(app, headers, {
      title: "Expired draft",
      content: "Cannot be published",
      scopeType: "system",
      expiresAt: "2000-01-01T00:00:00.000Z",
    });
    const expiredPublish = await app.request(`/api/announcements/${expired.id}/publish`, {
      method: "POST",
      headers,
    });
    expect(expiredPublish.status).toBe(400);

    const system = await createAnnouncement(app, headers, {
      title: "System notice",
      content: "Visible everywhere",
      scopeType: "system",
    });
    const scoped = await createAnnouncement(app, headers, {
      title: "Operations notice",
      content: "Visible in the operations subtree",
      scopeType: "organization",
      targetOrganizationIds: [childId],
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    await publish(app, headers, system.id);
    await publish(app, headers, scoped.id);

    const editPublished = await app.request(`/api/announcements/${scoped.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ title: "Not allowed" }),
    });
    const deletePublished = await app.request(`/api/announcements/${scoped.id}`, {
      method: "DELETE",
      headers,
    });
    expect(editPublished.status).toBe(409);
    expect(deletePublished.status).toBe(409);

    const rootCurrent = await currentAnnouncements(app, headers);
    expect(rootCurrent.items.map((item) => item.title)).toEqual(["System notice"]);

    headers = await switchOrganization(app, headers, childId);
    const childCurrent = await currentAnnouncements(app, headers);
    expect(childCurrent.items.map((item) => item.title).sort()).toEqual([
      "Operations notice",
      "System notice",
    ]);

    headers = await switchOrganization(app, headers, grandchildId);
    const descendantCurrent = await currentAnnouncements(app, headers);
    expect(descendantCurrent.items.map((item) => item.title).sort()).toEqual([
      "Operations notice",
      "System notice",
    ]);

    headers = await switchOrganization(app, headers, childId);
    const administratorHeaders = await loginHeaders(app);
    await setOrganizationStatus(app, administratorHeaders, childId, "disable");
    const disabledCurrent = await app.request("/api/announcements/current", { headers });
    expect(disabledCurrent.status).toBe(409);
    await setOrganizationStatus(app, administratorHeaders, childId, "enable");

    const catalogResponse = await app.request(
      "/api/announcements?status=published&scopeType=organization&page=1&pageSize=10",
      { headers },
    );
    expect(catalogResponse.status).toBe(200);
    await expect(catalogResponse.json()).resolves.toEqual({
      data: {
        items: [expect.objectContaining({ id: scoped.id, targetOrganizationIds: [childId] })],
        page: 1,
        pageSize: 10,
        total: 1,
      },
    });

    await unpublish(app, headers, scoped.id);
    const deleteDraft = await app.request(`/api/announcements/${scoped.id}`, {
      method: "DELETE",
      headers,
    });
    expect(deleteDraft.status).toBe(200);
    await expect(deleteDraft.json()).resolves.toEqual({
      data: expect.objectContaining({ id: scoped.id, status: "deleted", isDeleted: true }),
    });
  });

  it("requires authentication before calculating Current Announcements", async () => {
    const response = await createApp().request("/api/announcements/current");
    expect(response.status).toBe(401);
  });
});

type Headers = { authorization: string };

async function initialize(app: ReturnType<typeof createApp>): Promise<void> {
  const response = await app.request("/api/initialization/setup", {
    method: "POST",
    body: JSON.stringify({
      organizationName: "Default Organization",
      organizationCode: "default",
      adminUsername: "admin",
      adminDisplayName: "Super Admin",
      adminEmail: "admin@example.com",
      adminPhone: "10000000000",
      adminPassword: "password1",
    }),
  });
  expect(response.status).toBe(201);
}

async function loginHeaders(app: ReturnType<typeof createApp>): Promise<Headers> {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "password1" }),
  });
  const body = await response.json();
  return { authorization: `Bearer ${body.data.accessToken}` };
}

async function createOrganization(
  app: ReturnType<typeof createApp>,
  headers: Headers,
  input: { name: string; code: string; parentOrganizationId: string },
): Promise<string> {
  const response = await app.request("/api/organizations", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  expect(response.status).toBe(201);
  return String((await response.json()).data.id);
}

async function createAnnouncement(
  app: ReturnType<typeof createApp>,
  headers: Headers,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  const response = await app.request("/api/announcements", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  expect(response.status).toBe(201);
  return (await response.json()).data;
}

async function publish(app: ReturnType<typeof createApp>, headers: Headers, id: string) {
  const response = await app.request(`/api/announcements/${id}/publish`, {
    method: "POST",
    headers,
  });
  expect(response.status).toBe(200);
}

async function unpublish(app: ReturnType<typeof createApp>, headers: Headers, id: string) {
  const response = await app.request(`/api/announcements/${id}/unpublish`, {
    method: "POST",
    headers,
  });
  expect(response.status).toBe(200);
}

async function switchOrganization(
  app: ReturnType<typeof createApp>,
  headers: Headers,
  organizationId: string,
): Promise<Headers> {
  const response = await app.request("/api/context/current-organization", {
    method: "POST",
    headers,
    body: JSON.stringify({ organizationId }),
  });
  expect(response.status).toBe(200);
  return { authorization: `Bearer ${(await response.json()).data.accessToken}` };
}

async function setOrganizationStatus(
  app: ReturnType<typeof createApp>,
  headers: Headers,
  organizationId: string,
  action: "enable" | "disable",
): Promise<void> {
  const response = await app.request(`/api/organizations/${organizationId}/${action}`, {
    method: "POST",
    headers,
  });
  expect(response.status).toBe(200);
}

async function currentAnnouncements(app: ReturnType<typeof createApp>, headers: Headers) {
  const response = await app.request("/api/announcements/current", { headers });
  expect(response.status).toBe(200);
  return (await response.json()).data as {
    items: Array<{ title: string }>;
    page: number;
    pageSize: number;
    total: number;
  };
}
