import {
  baseApiPermissionManifest,
  baseMenuManifest,
  basePermissionManifest,
  baseRouteManifest
} from "@web-admin-base/contracts";
import { Hono } from "hono";

export function createManifestRoutes() {
  const routes = new Hono();

  routes.get("/permissions/manifest", (context) => {
    return context.json({ data: basePermissionManifest, apiPermissions: baseApiPermissionManifest });
  });

  routes.get("/routes/manifest", (context) => {
    return context.json({ data: baseRouteManifest });
  });

  routes.get("/menus/tree", (context) => {
    return context.json({ data: baseMenuManifest });
  });

  return routes;
}
