import { describe, expect, it } from "vitest";

import {
  createAnnouncementRequestSchema,
  listAnnouncementsQuerySchema,
  updateAnnouncementRequestSchema,
} from "../src";

describe("announcement contracts", () => {
  it("normalizes a system announcement to an empty target set", () => {
    expect(
      createAnnouncementRequestSchema.parse({ title: "Maintenance", content: "Window" }),
    ).toEqual({
      title: "Maintenance",
      content: "Window",
      scopeType: "system",
      targetOrganizationIds: [],
    });
  });

  it("requires distinct numeric organization targets for organization scope", () => {
    expect(() =>
      createAnnouncementRequestSchema.parse({
        title: "Maintenance",
        content: "Window",
        scopeType: "organization",
        targetOrganizationIds: [],
      }),
    ).toThrow();
    expect(() =>
      createAnnouncementRequestSchema.parse({
        title: "Maintenance",
        content: "Window",
        scopeType: "organization",
        targetOrganizationIds: ["1", "1"],
      }),
    ).toThrow();
    expect(() =>
      updateAnnouncementRequestSchema.parse({
        scopeType: "system",
        targetOrganizationIds: ["1"],
      }),
    ).toThrow();
  });

  it("parses bounded management pagination and UTC publication filters", () => {
    expect(
      listAnnouncementsQuerySchema.parse({
        status: "published",
        scopeType: "organization",
        publishedFrom: "2026-07-01T00:00:00.000Z",
        publishedTo: "2026-07-31T23:59:59.999Z",
        page: "2",
        pageSize: "50",
      }),
    ).toEqual({
      status: "published",
      scopeType: "organization",
      publishedFrom: "2026-07-01T00:00:00.000Z",
      publishedTo: "2026-07-31T23:59:59.999Z",
      page: 2,
      pageSize: 50,
    });
  });
});
