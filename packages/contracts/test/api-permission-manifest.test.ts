import { describe, expect, it } from "vitest";

import { baseApiPermissionManifest } from "../src";

describe("baseApiPermissionManifest", () => {
  it("uses unique API permission codes and method/path pairs", () => {
    const codes = baseApiPermissionManifest.map((entry) => entry.code);
    const methodPaths = baseApiPermissionManifest.map((entry) => `${entry.method} ${entry.path}`);

    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(methodPaths).size).toBe(methodPaths.length);
  });

  it("declares metadata for backend-core route surfaces", () => {
    expect(baseApiPermissionManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "POST", path: "/api/auth/login", public: true }),
        expect.objectContaining({
          method: "POST",
          path: "/api/users/:id/reset-password",
          requiredPermission: "user:password:reset"
        }),
        expect.objectContaining({
          method: "POST",
          path: "/api/roles/:id/copy",
          requiredPermission: "role:copy"
        })
      ])
    );
  });
});
