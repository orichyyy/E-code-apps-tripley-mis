import { describe, expect, it } from "vitest";

import { AppError } from "../src/core/errors/app-error";
import { createInMemoryBackendCoreServices } from "../src/modules/core-foundation/services";

describe("OrganizationService", () => {
  it("returns a stable business error when root organization segments are exhausted", async () => {
    const services = createInMemoryBackendCoreServices();
    await services.initialize({
      organizationName: "Default Organization",
      organizationCode: "default",
      adminUsername: "admin",
      adminDisplayName: "Super Admin",
      adminEmail: "admin@example.com",
      adminPhone: "10000000000",
      adminPassword: "password1"
    });

    for (let index = 2; index <= 127; index += 1) {
      services.createOrganization({
        name: `Root ${index}`,
        code: `root-${index}`
      });
    }

    let caught: unknown;
    try {
      services.createOrganization({
        name: "Overflow Root",
        code: "overflow-root"
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).code).toBe("BUSINESS_ORG_SEGMENT_RANGE_EXHAUSTED");
    expect((caught as AppError).status).toBe(409);
  });
});
