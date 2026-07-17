import { baseApiPermissionManifest, type BaseApiPermissionManifestEntry } from "../manifests";
import { requestSchemaByOperationCode } from "./request-schema-map";
import { queryParametersByOperationCode } from "./parameter-map";
import { responseSchemaByOperationCode } from "./response-schema-map";
import { componentSchemas, errorSchema, idStringSchema } from "./schemas";
import type { OpenApiDocument, OpenApiOperation } from "./types";

export type {
  OpenApiDocument,
  OpenApiDocumentFactory,
  OpenApiOperation,
  OpenApiSchema,
} from "./types";

export function createOpenApiDocument(): OpenApiDocument {
  return {
    openapi: "3.1.0",
    info: {
      title: "Web Admin Base System API",
      version: "0.1.0",
      description:
        "OpenAPI document generated from implemented API manifests and Zod-backed contracts.",
    },
    servers: [{ url: "/api" }],
    paths: createOpenApiPaths(),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        refreshCookie: {
          type: "apiKey",
          in: "cookie",
          name: "refresh_token",
        },
      },
      schemas: componentSchemas,
    },
  };
}

function createOpenApiPaths(): OpenApiDocument["paths"] {
  const paths: OpenApiDocument["paths"] = {};

  for (const entry of baseApiPermissionManifest) {
    const path = toOpenApiPath(entry.path);
    const method = entry.method.toLowerCase() as Lowercase<
      BaseApiPermissionManifestEntry["method"]
    >;
    paths[path] = {
      ...paths[path],
      [method]: createOperation(entry),
    };
  }

  return paths;
}

function createOperation(entry: BaseApiPermissionManifestEntry): OpenApiOperation {
  const requestSchemaName = requestSchemaByOperationCode[entry.code];
  const responseSchemaName = responseSchemaByOperationCode[entry.code];
  const parameters = [
    ...createPathParameters(entry.path),
    ...(queryParametersByOperationCode[entry.code] ?? []),
  ];

  return {
    operationId: toOperationId(entry),
    tags: [entry.module],
    summary: entry.description,
    description: entry.requiredPermission
      ? `${entry.description}. Required permission: ${entry.requiredPermission}.`
      : entry.description,
    ...(entry.public ? {} : { security: [{ bearerAuth: [] }] }),
    ...(parameters.length === 0 ? {} : { parameters }),
    ...(requestSchemaName ? { requestBody: createRequestBody(requestSchemaName) } : {}),
    responses: createResponses(entry.code, responseSchemaName),
    "x-permission-code": entry.code,
    ...(entry.requiredPermission ? { "x-required-permission": entry.requiredPermission } : {}),
    "x-log-level": entry.logLevel,
    "x-public": entry.public,
  };
}

function createRequestBody(schemaName: string): NonNullable<OpenApiOperation["requestBody"]> {
  if (schemaName === "FileUploadRequest") {
    return {
      required: true,
      content: {
        "multipart/form-data": {
          schema: { $ref: `#/components/schemas/${schemaName}` },
        },
      },
    };
  }

  return {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${schemaName}` },
      },
    },
  };
}

function createStandardResponses(responseSchemaName?: string): OpenApiOperation["responses"] {
  return {
    "200": {
      description: "Successful response",
      content: {
        "application/json": {
          schema: responseSchemaName
            ? { $ref: `#/components/schemas/${responseSchemaName}` }
            : { type: "object", description: "Response envelope for this endpoint." },
        },
      },
    },
    "400": {
      description: "Validation error",
      content: { "application/json": { schema: errorSchema } },
    },
    "401": {
      description: "Authentication error",
      content: { "application/json": { schema: errorSchema } },
    },
    "403": {
      description: "Authorization or business-rule denial",
      content: { "application/json": { schema: errorSchema } },
    },
    "500": {
      description: "System error",
      content: { "application/json": { schema: errorSchema } },
    },
  };
}

function createResponses(
  operationCode: string,
  responseSchemaName?: string,
): OpenApiOperation["responses"] {
  const standard = createStandardResponses(responseSchemaName);
  if (operationCode !== "api.files.download" && operationCode !== "api.files.preview") {
    return standard;
  }
  return {
    ...standard,
    "200": {
      description: "Authenticated local file content",
      content: {
        "application/octet-stream": { schema: { type: "string", format: "binary" } },
      },
    },
    "302": {
      description: "Short-lived private S3 download URL",
      headers: {
        Location: {
          description: "Presigned S3-compatible URL; never persisted in file metadata.",
          schema: { type: "string", format: "uri" },
        },
      },
    },
  };
}

function toOpenApiPath(path: string) {
  return path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, "{$1}").replace(/^\/api/, "");
}

function createPathParameters(path: string) {
  const matches = path.matchAll(/:([A-Za-z][A-Za-z0-9]*)/g);
  return [...matches].map((match) => ({
    name: match[1],
    in: "path" as const,
    required: true,
    schema: idStringSchema,
  }));
}

function toOperationId(entry: BaseApiPermissionManifestEntry) {
  return entry.code.replace(/[^A-Za-z0-9]+(.)/g, (_, character: string) => character.toUpperCase());
}
