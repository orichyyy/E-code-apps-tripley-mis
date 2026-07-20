import { basePermissionManifest } from "../permissions/permission-manifest";
import { baseApiPermissionManifest } from "../manifests/base-api-permissions";
import { baseMenuManifest } from "../manifests/base-menus";
import { baseRouteManifest } from "../manifests/base-routes";

export const baseSystemCompatibilityDefinition = {
  kind: "base-system",
  ownerCode: "base-system",
  permissions: basePermissionManifest,
  apiPermissions: baseApiPermissionManifest,
  routes: baseRouteManifest,
  menus: baseMenuManifest,
} as const;

export type BaseSystemCompatibilityDefinition = typeof baseSystemCompatibilityDefinition;
