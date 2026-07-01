import { describe, expect, it } from "vitest";

import { healthResponseSchema } from "../src";

describe("healthResponseSchema", () => {
  it("validates the health contract", () => {
    expect(
      healthResponseSchema.parse({
        status: "ok",
        service: "api",
        requestId: "request-1",
        timestamp: new Date().toISOString()
      })
    ).toMatchObject({ status: "ok" });
  });
});
