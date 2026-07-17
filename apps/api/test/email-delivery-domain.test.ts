import { describe, expect, it } from "vitest";

import {
  createEmailRequestFingerprint,
  maskEmailAddress,
  renderStrictEmailTemplate,
} from "../src/modules/infrastructure/email-delivery-domain";

describe("email delivery domain rules", () => {
  it("creates the same fingerprint regardless of variable insertion order", () => {
    const first = createEmailRequestFingerprint({
      userId: "12",
      templateCode: "account.notice",
      variables: { name: "Ada", count: 2 },
    });
    const second = createEmailRequestFingerprint({
      userId: "12",
      templateCode: "account.notice",
      variables: { count: 2, name: "Ada" },
    });

    expect(first).toBe(second);
  });

  it("requires declared, used, and supplied variables to be exact sets", () => {
    expect(() =>
      renderStrictEmailTemplate("Hello {{name}}", "Count: {{count}}", ["name", "count"], {
        name: "Ada",
      }),
    ).toThrow("Template variables do not match");
    expect(() => renderStrictEmailTemplate("Hello", "Body", ["unused"], { unused: true })).toThrow(
      "Template declarations do not match",
    );
  });

  it("renders primitive values and masks the recipient", () => {
    expect(
      renderStrictEmailTemplate("Hello {{name}}", "Enabled: {enabled}", ["name", "enabled"], {
        name: "Ada",
        enabled: true,
      }),
    ).toEqual({ subject: "Hello Ada", body: "Enabled: true" });
    expect(maskEmailAddress("alice@example.com")).toBe("a***e@example.com");
  });
});
