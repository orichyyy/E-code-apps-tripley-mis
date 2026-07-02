import { describe, expect, it } from "vitest";

import { postgresql, sqlite } from "../src";

describe("backend core schema", () => {
  it("keeps permission metadata columns aligned across SQLite and PostgreSQL", () => {
    expect(sqlite.permissions.module.name).toBe("module");
    expect(postgresql.permissions.module.name).toBe("module");
  });

  it("keeps API permission metadata columns aligned across SQLite and PostgreSQL", () => {
    expect(sqlite.apiPermissions.module.name).toBe("module");
    expect(sqlite.apiPermissions.requiredPermission.name).toBe("required_permission");
    expect(sqlite.apiPermissions.public.name).toBe("public");
    expect(postgresql.apiPermissions.module.name).toBe("module");
    expect(postgresql.apiPermissions.requiredPermission.name).toBe("required_permission");
    expect(postgresql.apiPermissions.public.name).toBe("public");
  });
});
