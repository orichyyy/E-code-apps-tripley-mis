import { describe, expect, it } from "vitest";

import { baseApiPermissionManifest, createOpenApiDocument } from "../src";

describe("OpenAPI document generation", () => {
  it("documents every implemented API permission manifest entry", () => {
    const document = createOpenApiDocument();
    const documentedOperations = Object.entries(document.paths)
      .flatMap(([path, methods]) =>
        Object.entries(methods).map(([method, operation]) => ({
          method: method.toUpperCase(),
          path: `/api${path}`,
          operation
        }))
      )
      .sort((left, right) => `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`));
    const manifestOperations = baseApiPermissionManifest
      .map((entry) => ({
        method: entry.method,
        path: toOpenApiTestPath(entry.path),
        code: entry.code
      }))
      .sort((left, right) => `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`));

    expect(
      documentedOperations.map((operation) => ({
        method: operation.method,
        path: operation.path,
        code: operation.operation?.["x-permission-code"]
      }))
    ).toEqual(manifestOperations);
  });

  it("marks private routes with bearer security and keeps public routes public", () => {
    const document = createOpenApiDocument();
    const login = document.paths["/auth/login"]?.post;
    const users = document.paths["/users"]?.get;

    expect(login?.security).toBeUndefined();
    expect(login?.["x-public"]).toBe(true);
    expect(users?.security).toEqual([{ bearerAuth: [] }]);
    expect(users?.["x-required-permission"]).toBe("user:view");
  });

  it("maps implemented JSON request schemas to OpenAPI component references", () => {
    const document = createOpenApiDocument();

    expect(document.paths["/auth/login"]?.post?.requestBody).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/LoginRequest" }
        }
      }
    });
    expect(document.components.schemas.CreateUserRequest.required).toContain("primaryOrganizationId");
    expect(document.paths["/roles/{id}/data-permissions"]?.put?.requestBody).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/UpdateRoleDataPermissionsRequest" }
        }
      }
    });
    expect(document.paths["/roles/{id}/field-permissions"]?.put?.requestBody).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/UpdateRoleFieldPermissionsRequest" }
        }
      }
    });
    expect(document.paths["/permissions/user-overrides/{userId}"]?.put?.requestBody).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/UpdateUserPermissionOverridesRequest" }
        }
      }
    });
  });

  it("documents permission extension and effective permission responses", () => {
    const document = createOpenApiDocument();

    expect(document.paths["/roles/{id}/data-permissions"]?.get?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/RoleDataPermissionListResponse" }
        }
      }
    });
    expect(document.paths["/roles/{id}/field-permissions"]?.get?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/RoleFieldPermissionListResponse" }
        }
      }
    });
    expect(document.paths["/permissions/user-overrides/{userId}"]?.get?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/UserPermissionOverrideListResponse" }
        }
      }
    });
    expect(document.paths["/permissions/effective"]?.get?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/PermissionContextResponse" }
        }
      }
    });
    expect(document.components.schemas.PermissionContextResponse).toMatchObject({
      properties: {
        data: {
          properties: {
            dataPermissions: { type: "array" },
            fieldPermissions: { type: "array" },
            userPermissionOverrides: { type: "array" }
          }
        }
      }
    });
  });
});

function toOpenApiTestPath(path: string) {
  return path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, "{$1}");
}
