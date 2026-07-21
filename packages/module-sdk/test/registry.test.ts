import { describe, expect, it } from "vitest";

import { createBusinessModuleRegistry, defineBusinessModule } from "../src";

function moduleDefinition(moduleCode: string, defaultMessage = moduleCode) {
  return defineBusinessModule({
    contractVersion: 1,
    moduleCode,
    defaultLocale: "en",
    title: {
      key: `modules.${moduleCode}.title`,
      defaultMessage,
    },
  });
}

describe("Business Module Registry", () => {
  it("normalizes ordering and produces deterministic hashes", () => {
    const first = createBusinessModuleRegistry([
      moduleDefinition("zeta-module"),
      moduleDefinition("alpha-module"),
    ]);
    const second = createBusinessModuleRegistry([
      moduleDefinition("alpha-module"),
      moduleDefinition("zeta-module"),
    ]);

    expect(first).toEqual(second);
    expect(first.modules.map((entry) => entry.definition.moduleCode)).toEqual([
      "alpha-module",
      "zeta-module",
    ]);
  });

  it("does not treat presentation-only changes as activation changes", () => {
    const before = createBusinessModuleRegistry([moduleDefinition("regional-ops", "Before")]);
    const after = createBusinessModuleRegistry([moduleDefinition("regional-ops", "After")]);

    expect(after.registryHash).not.toBe(before.registryHash);
    expect(after.modules[0]?.definitionHash).not.toBe(before.modules[0]?.definitionHash);
    expect(after.modules[0]?.activationHash).toBe(before.modules[0]?.activationHash);
  });
});
