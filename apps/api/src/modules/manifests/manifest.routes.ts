import { baseApiPermissionManifest, basePermissionManifest } from "@web-admin-base/contracts";
import { Hono } from "hono";

export function createManifestRoutes() {
  const routes = new Hono();

  routes.get("/permissions/manifest", (context) => {
    return context.json({
      data: basePermissionManifest,
      apiPermissions: baseApiPermissionManifest,
    });
  });

  return routes;
}
