import { describe, expect, it } from "vitest";

import { listErrorCodeDefinitions } from "../src/core/errors/error-codes";

describe("error code specification", () => {
  it("implements the required error code categories", () => {
    const categories = new Set(
      listErrorCodeDefinitions().map((definition) => definition.category)
    );

    expect(categories).toEqual(
      new Set([
        "authentication",
        "authorization",
        "validation",
        "business",
        "system",
        "third-party"
      ])
    );
  });

  it("keeps error codes stable and categorized", () => {
    expect(listErrorCodeDefinitions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "AUTH_INVALID_CREDENTIALS",
          category: "authentication"
        }),
        expect.objectContaining({ code: "PERMISSION_DENIED", category: "authorization" }),
        expect.objectContaining({ code: "VALIDATION_INVALID_REQUEST", category: "validation" }),
        expect.objectContaining({ code: "BUSINESS_ORG_DISABLED", category: "business" }),
        expect.objectContaining({ code: "SYSTEM_INTERNAL_ERROR", category: "system" }),
        expect.objectContaining({
          code: "THIRD_PARTY_INTEGRATION_FAILED",
          category: "third-party"
        })
      ])
    );
  });
});
