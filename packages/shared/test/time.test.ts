import { describe, expect, it } from "vitest";

import { nowUtcIso } from "../src";

describe("nowUtcIso", () => {
  it("returns an ISO timestamp", () => {
    expect(nowUtcIso()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
