import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLocalFileStorageAdapter } from "../src";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("createLocalFileStorageAdapter", () => {
  it("writes through a temp file then atomically renames into place", async () => {
    const root = createTempDirectory();
    const storage = createLocalFileStorageAdapter({ rootDirectory: root });
    const body = new TextEncoder().encode("file content");

    const stored = await storage.put("exports/result.csv", body, "text/csv");
    const read = await storage.get("exports/result.csv");

    expect(stored).toEqual({
      objectKey: "exports/result.csv",
      contentType: "text/csv",
      sizeBytes: body.byteLength,
    });
    expect(new TextDecoder().decode(read ?? new Uint8Array())).toBe("file content");
    expect(existsSync(join(root, "exports", "result.csv"))).toBe(true);
  });

  it("prevents object keys from escaping the storage root", async () => {
    const root = createTempDirectory();
    const storage = createLocalFileStorageAdapter({ rootDirectory: root });

    await expect(storage.put("../outside.txt", new Uint8Array(), "text/plain")).rejects.toThrow(
      "storage root",
    );
  });
});

function createTempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "web-admin-base-storage-"));
  directories.push(directory);
  return directory;
}
