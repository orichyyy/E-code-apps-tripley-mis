import { describe, expect, it } from "vitest";

import { emailNotificationRequestSchema, updateNotificationTemplateRequestSchema } from "../src";

describe("reliable email contracts", () => {
  it("accepts only primitive request variables", () => {
    expect(
      emailNotificationRequestSchema.parse({
        requestKey: "welcome-41",
        userId: "41",
        templateCode: "welcome",
        variables: { name: "Ada", count: 1, active: true, note: null },
      }),
    ).toMatchObject({ requestKey: "welcome-41" });
    expect(() =>
      emailNotificationRequestSchema.parse({
        requestKey: "welcome-41",
        userId: "41",
        templateCode: "welcome",
        variables: { nested: { unsafe: true } },
      }),
    ).toThrow();
  });

  it("keeps notification template identity immutable through update", () => {
    expect(updateNotificationTemplateRequestSchema.parse({ body: "Updated {name}" })).toEqual({
      body: "Updated {name}",
    });
    expect(() => updateNotificationTemplateRequestSchema.parse({ code: "renamed" })).toThrow();
  });
});
