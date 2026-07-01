import { describe, expect, it } from "vitest";

import { createDatabase } from "../src";

describe("createDatabase", () => {
  it("requires a configured factory for the selected dialect", () => {
    expect(() => createDatabase({ dialect: "sqlite", url: "file:test.db" }, {})).toThrow(
      "No database factory configured for sqlite"
    );
  });

  it("creates a database handle through the configured factory", () => {
    const handle = createDatabase(
      { dialect: "postgresql", url: "postgres://example" },
      { postgresql: (url) => ({ url }) }
    );

    expect(handle.dialect).toBe("postgresql");
  });
});
