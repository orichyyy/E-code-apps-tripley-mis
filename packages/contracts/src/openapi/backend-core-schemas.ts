import type { OpenApiDocument } from "./types";
import { backendCoreEntitySchemas } from "./backend-core-entity-schemas";
import { backendCoreResponseSchemas } from "./backend-core-response-schemas";

export const backendCoreComponentSchemas: OpenApiDocument["components"]["schemas"] = {
  ...backendCoreEntitySchemas,
  ...backendCoreResponseSchemas
};
