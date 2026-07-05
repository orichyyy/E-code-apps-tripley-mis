import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { createDatabase, createDefaultDatabase, getSqliteFilename } from "../src";

describe("createDatabase", () => {
  it("requires a configured factory for the selected dialect", () => {
    expect(() => createDatabase({ dialect: "sqlite", url: "file:test.db" }, {})).toThrow(
      "No database factory configured for sqlite",
    );
  });

  it("creates a database handle through the configured factory", () => {
    const handle = createDatabase(
      { dialect: "postgresql", url: "postgres://example" },
      { postgresql: (url) => ({ url }) },
    );

    expect(handle.dialect).toBe("postgresql");
  });

  it("creates a default SQLite database handle", () => {
    const handle = createDefaultDatabase({ dialect: "sqlite", url: ":memory:" });

    expect(handle.dialect).toBe("sqlite");
    expect(handle.client).toBeDefined();
  });

  it("resolves relative SQLite file URLs from the original command directory", () => {
    const baseDirectory = join(tmpdir(), "web-admin-base-sqlite-base");

    expect(getSqliteFilename("file:./data/web-admin-base.sqlite", baseDirectory)).toBe(
      resolve(baseDirectory, "data", "web-admin-base.sqlite"),
    );
    expect(getSqliteFilename(":memory:", baseDirectory)).toBe(":memory:");
  });
});
