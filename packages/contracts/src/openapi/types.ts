import type { BaseApiPermissionManifestEntry } from "../manifests";

export type OpenApiSchema = {
  $ref?: string;
  type?: string;
  format?: string;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  required?: string[];
  additionalProperties?: boolean | OpenApiSchema;
  enum?: Array<string | number>;
  nullable?: boolean;
  description?: string;
  anyOf?: OpenApiSchema[];
  allOf?: OpenApiSchema[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
};

export type OpenApiOperation = {
  operationId: string;
  tags: string[];
  summary: string;
  description: string;
  security?: Array<Record<string, string[]>>;
  parameters?: Array<{
    name: string;
    in: "path" | "query" | "header" | "cookie";
    required: boolean;
    schema: OpenApiSchema;
  }>;
  requestBody?: {
    required: boolean;
    content: Record<string, { schema: OpenApiSchema }>;
  };
  responses: Record<
    string,
    {
      description: string;
      headers?: Record<string, { description: string; schema: OpenApiSchema }>;
      content?: Record<string, { schema: OpenApiSchema }>;
    }
  >;
  "x-permission-code": string;
  "x-required-permission"?: string;
  "x-log-level": BaseApiPermissionManifestEntry["logLevel"];
  "x-public": boolean;
};

export type OpenApiDocument = {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string }>;
  paths: Record<
    string,
    Partial<Record<Lowercase<BaseApiPermissionManifestEntry["method"]>, OpenApiOperation>>
  >;
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http";
        scheme: "bearer";
        bearerFormat: "JWT";
      };
      refreshCookie: {
        type: "apiKey";
        in: "cookie";
        name: string;
      };
    };
    schemas: Record<string, OpenApiSchema>;
  };
};

export type OpenApiDocumentFactory = () => OpenApiDocument;
