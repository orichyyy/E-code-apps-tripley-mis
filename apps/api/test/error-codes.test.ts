import { describe, expect, it } from "vitest";
import {
  BusinessFieldPermissionError,
  BusinessModuleCapabilityError,
  BusinessModuleDeclaredError,
} from "@web-admin-base/module-sdk";

import { listErrorCodeDefinitions } from "../src/core/errors/error-codes";
import { normalizeError } from "../src/core/errors/error-response";

describe("error code specification", () => {
  it("implements the required error code categories", () => {
    const categories = new Set(listErrorCodeDefinitions().map((definition) => definition.category));

    expect(categories).toEqual(
      new Set([
        "authentication",
        "authorization",
        "validation",
        "business",
        "system",
        "third-party",
      ]),
    );
  });

  it("keeps error codes stable and categorized", () => {
    expect(listErrorCodeDefinitions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "AUTH_INVALID_CREDENTIALS",
          category: "authentication",
        }),
        expect.objectContaining({ code: "PERMISSION_DENIED", category: "authorization" }),
        expect.objectContaining({ code: "VALIDATION_INVALID_REQUEST", category: "validation" }),
        expect.objectContaining({ code: "BUSINESS_ORG_DISABLED", category: "business" }),
        expect.objectContaining({ code: "SYSTEM_INTERNAL_ERROR", category: "system" }),
        expect.objectContaining({
          code: "THIRD_PARTY_INTEGRATION_FAILED",
          category: "third-party",
        }),
      ]),
    );
  });

  it("normalizes Business Module field write denials as authorization errors", () => {
    const error = normalizeError(new BusinessFieldPermissionError(["secret", "ownerUserId"]));

    expect(error).toMatchObject({
      code: "PERMISSION_FIELD_DENIED",
      status: 403,
      category: "authorization",
      details: { fields: ["secret", "ownerUserId"] },
    });
  });

  it("normalizes declared module and capability errors", () => {
    expect(
      normalizeError(
        new BusinessModuleDeclaredError(
          "BUSINESS_FIXTURE_CONFLICT",
          409,
          { key: "modules.fixture.errors.conflict", defaultMessage: "Conflict" },
          { recordId: "9" },
        ),
      ),
    ).toMatchObject({
      code: "BUSINESS_FIXTURE_CONFLICT",
      status: 409,
      category: "business",
      details: { recordId: "9" },
    });
    expect(normalizeError(new BusinessModuleCapabilityError("secret"))).toMatchObject({
      code: "PERMISSION_MODULE_CAPABILITY_DENIED",
      status: 403,
    });
  });
});
