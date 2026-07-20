import { describe, expect, it } from "vitest";

import { parseModuleSyncCliArgs } from "../src/module-sync";

describe("Module Sync CLI", () => {
  it("defaults to a read-only plan", () => {
    expect(parseModuleSyncCliArgs([])).toEqual({ mode: "plan" });
  });

  it("requires the reviewed hash and explicit confirmation for Apply", () => {
    const hash = "a".repeat(64);
    expect(
      parseModuleSyncCliArgs(["--apply", `--expected-registry-hash=${hash}`, "--confirmed"]),
    ).toEqual({ mode: "apply", expectedRegistryHash: hash });
    expect(() => parseModuleSyncCliArgs(["--apply", "--confirmed"])).toThrow(
      "--expected-registry-hash",
    );
    expect(() => parseModuleSyncCliArgs(["--apply", `--expected-registry-hash=${hash}`])).toThrow(
      "--confirmed",
    );
  });
});
