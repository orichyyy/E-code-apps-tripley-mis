import { describe, expect, it } from "vitest";

import { selectActiveModuleRegistrations } from "../src";

describe("Business Module runtime activation", () => {
  it("selects only registrations accepted for the current activation hash", () => {
    const registrations = [
      { moduleCode: "pending-module", routes: ["pending-module.home"] },
      { moduleCode: "active-module", routes: ["active-module.home"] },
    ];

    expect(selectActiveModuleRegistrations(registrations, new Set(["active-module"]))).toEqual([
      registrations[1],
    ]);
  });
});
