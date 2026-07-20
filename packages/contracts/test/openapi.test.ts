import { describe, expect, it } from "vitest";

import { baseApiPermissionManifest, createOpenApiDocument } from "../src";

describe("OpenAPI document generation", () => {
  it("documents Business Module registry lifecycle APIs with explicit schemas", () => {
    const document = createOpenApiDocument();

    expect(
      document.paths["/modules/registry"]?.get?.responses["200"]?.content?.["application/json"]
        ?.schema,
    ).toEqual({ $ref: "#/components/schemas/BusinessModuleRegistryResponse" });
    expect(
      document.paths["/modules/sync/plan"]?.post?.responses["200"]?.content?.["application/json"]
        ?.schema,
    ).toEqual({ $ref: "#/components/schemas/ModuleSyncPlanResponse" });
    expect(
      document.paths["/modules/sync/apply"]?.post?.requestBody?.content["application/json"]?.schema,
    ).toEqual({ $ref: "#/components/schemas/ApplyModuleSyncRequest" });
  });

  it("documents every implemented API permission manifest entry", () => {
    const document = createOpenApiDocument();
    const documentedOperations = Object.entries(document.paths)
      .flatMap(([path, methods]) =>
        Object.entries(methods).map(([method, operation]) => ({
          method: method.toUpperCase(),
          path: `/api${path}`,
          operation,
        })),
      )
      .sort((left, right) =>
        `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`),
      );
    const manifestOperations = baseApiPermissionManifest
      .map((entry) => ({
        method: entry.method,
        path: toOpenApiTestPath(entry.path),
        code: entry.code,
      }))
      .sort((left, right) =>
        `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`),
      );

    expect(
      documentedOperations.map((operation) => ({
        method: operation.method,
        path: operation.path,
        code: operation.operation?.["x-permission-code"],
      })),
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
          schema: { $ref: "#/components/schemas/LoginRequest" },
        },
      },
    });
    expect(document.components.schemas.CreateUserRequest.required).toContain(
      "primaryOrganizationId",
    );
    expect(document.paths["/roles/{id}/data-permissions"]?.put?.requestBody).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/UpdateRoleDataPermissionsRequest" },
        },
      },
    });
    expect(document.paths["/roles/{id}/field-permissions"]?.put?.requestBody).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/UpdateRoleFieldPermissionsRequest" },
        },
      },
    });
    expect(document.paths["/permissions/user-overrides/{userId}"]?.put?.requestBody).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/UpdateUserPermissionOverridesRequest" },
        },
      },
    });
  });

  it("documents permission extension and effective permission responses", () => {
    const document = createOpenApiDocument();

    expect(document.paths["/roles/{id}/data-permissions"]?.get?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/RoleDataPermissionListResponse" },
        },
      },
    });
    expect(document.paths["/roles/{id}/field-permissions"]?.get?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/RoleFieldPermissionListResponse" },
        },
      },
    });
    expect(
      document.paths["/permissions/user-overrides/{userId}"]?.get?.responses["200"],
    ).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/UserPermissionOverrideListResponse" },
        },
      },
    });
    expect(document.paths["/permissions/effective"]?.get?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/PermissionContextResponse" },
        },
      },
    });
    expect(document.components.schemas.PermissionContextResponse).toMatchObject({
      properties: {
        data: {
          properties: {
            dataPermissions: { type: "array" },
            fieldPermissions: { type: "array" },
            userPermissionOverrides: { type: "array" },
          },
        },
      },
    });
  });

  it("maps backend-core API responses to named OpenAPI component schemas", () => {
    const document = createOpenApiDocument();
    const backendCoreModules = new Set([
      "initialization",
      "auth",
      "organizations",
      "users",
      "roles",
      "permissions",
      "routes",
      "menus",
    ]);

    const backendCoreOperations = baseApiPermissionManifest.filter((entry) =>
      backendCoreModules.has(entry.module),
    );

    expect(backendCoreOperations.length).toBeGreaterThan(0);
    for (const entry of backendCoreOperations) {
      const path = toOpenApiTestPath(entry.path).replace(/^\/api/, "");
      const method = entry.method.toLowerCase() as keyof NonNullable<
        (typeof document.paths)[string]
      >;
      const responseSchema =
        document.paths[path]?.[method]?.responses["200"]?.content?.["application/json"]?.schema;

      expect(responseSchema, `${entry.code} should use a named response schema`).toMatchObject({
        $ref: expect.stringMatching(/^#\/components\/schemas\/.+Response$/),
      });
    }
  });

  it("keeps mapped response schema references resolvable", () => {
    const document = createOpenApiDocument();

    for (const methods of Object.values(document.paths)) {
      for (const operation of Object.values(methods)) {
        const schema = operation?.responses["200"]?.content?.["application/json"]?.schema;
        const schemaName = schema?.$ref?.replace("#/components/schemas/", "");
        if (!schemaName) continue;
        expect(document.components.schemas[schemaName], `${schemaName} should exist`).toBeDefined();
      }
    }
  });

  it("documents infrastructure response items with concrete schemas", () => {
    const document = createOpenApiDocument();
    const listResponses = [
      "LogEntryListResponse",
      "FileObjectListResponse",
      "FileReferenceListResponse",
      "NotificationListResponse",
      "NotificationTemplateListResponse",
      "ScheduledTaskListResponse",
      "ImportExportTaskListResponse",
    ];
    const itemSchemas = [
      "LogEntry",
      "FileObject",
      "FileReference",
      "Notification",
      "NotificationTemplate",
      "ScheduledTask",
      "ImportExportTask",
    ];

    for (const responseName of listResponses) {
      const responseSchema = document.components.schemas[responseName];
      expect(
        responseSchema.properties?.data.items?.$ref,
        `${responseName} should reference a concrete item`,
      ).toMatch(/^#\/components\/schemas\/.+/);
    }

    for (const schemaName of itemSchemas) {
      const schema = document.components.schemas[schemaName];
      expect(schema, `${schemaName} should exist`).toBeDefined();
      expect(schema.type, `${schemaName} should be an object schema`).toBe("object");
      expect(
        schema.required?.length,
        `${schemaName} should define required fields`,
      ).toBeGreaterThan(0);
      expect(schema.additionalProperties, `${schemaName} should not be a broad object`).toBe(false);
    }
  });

  it("documents local file content and private S3 redirect responses", () => {
    const document = createOpenApiDocument();
    const download = document.paths["/files/{id}/download"]?.get;
    const preview = document.paths["/files/{id}/preview"]?.get;

    for (const operation of [download, preview]) {
      expect(operation?.responses["200"]).toMatchObject({
        content: {
          "application/octet-stream": { schema: { type: "string", format: "binary" } },
        },
      });
      expect(operation?.responses["302"]).toMatchObject({
        headers: { Location: { schema: { type: "string", format: "uri" } } },
      });
    }
  });

  it("documents webhook delivery filters and safe response schemas", () => {
    const document = createOpenApiDocument();
    const list = document.paths["/webhook-deliveries"]?.get;
    const detail = document.paths["/webhook-deliveries/{id}"]?.get;

    expect(list?.parameters?.map((parameter) => parameter.name)).toEqual([
      "subscriptionId",
      "eventType",
      "status",
      "from",
      "to",
      "page",
      "pageSize",
    ]);
    expect(list?.responses["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/WebhookDeliveryListResponse",
    });
    expect(detail?.responses["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/WebhookDeliveryDetailResponse",
    });
    expect(document.components.schemas.WebhookSubscription.properties).not.toHaveProperty("secret");
    expect(document.components.schemas.WebhookDelivery.properties).not.toHaveProperty(
      "eventPayload",
    );
  });

  it("documents scoped announcement contracts and current-user visibility", () => {
    const document = createOpenApiDocument();
    const catalog = document.paths["/announcements"]?.get;
    const current = document.paths["/announcements/current"]?.get;
    const remove = document.paths["/announcements/{id}"]?.delete;

    expect(catalog?.parameters?.map((parameter) => parameter.name)).toEqual([
      "status",
      "scopeType",
      "publishedFrom",
      "publishedTo",
      "page",
      "pageSize",
    ]);
    expect(current?.security).toEqual([{ bearerAuth: [] }]);
    expect(current?.["x-required-permission"]).toBeUndefined();
    expect(current?.responses["200"]?.content?.["application/json"]?.schema).toEqual({
      $ref: "#/components/schemas/CurrentAnnouncementListResponse",
    });
    expect(remove?.["x-required-permission"]).toBe("announcement:delete");
    expect(document.components.schemas.Announcement.required).toEqual(
      expect.arrayContaining(["targetOrganizationIds", "expiresAt"]),
    );
  });
});

function toOpenApiTestPath(path: string) {
  return path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, "{$1}");
}
