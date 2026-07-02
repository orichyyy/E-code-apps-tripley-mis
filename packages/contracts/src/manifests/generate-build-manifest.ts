import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createOpenApiDocument } from "../openapi";
import { baseApiPermissionManifest } from "./base-api-permissions";
import { baseMenuManifest } from "./base-menus";
import { baseRouteManifest } from "./base-routes";
import { basePermissionManifest } from "../permissions/permission-manifest";

const outputPath = resolve("generated/base-system-manifests.json");

const artifact = {
  generatedAt: new Date().toISOString(),
  permissions: basePermissionManifest,
  apiPermissions: baseApiPermissionManifest,
  routes: baseRouteManifest,
  menus: baseMenuManifest,
  openapi: createOpenApiDocument()
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
