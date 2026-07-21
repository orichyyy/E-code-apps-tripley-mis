import { Hono } from "hono";

import { createAuthRoutes } from "./auth.routes";
import { createInitializationRoutes } from "./initialization.routes";
import { createMenuRoutes } from "./menu.routes";
import { createOrganizationRoutes } from "./organization.routes";
import { createPermissionExtensionRoutes } from "./permission-extension.routes";
import { createProfileRoutes } from "./profile.routes";
import { createRoleRoutes } from "./role.routes";
import { createRouteMetadataRoutes } from "./route-metadata.routes";
import { createUserRoutes } from "./user.routes";
import type { BackendCoreServices } from "./services";

export function createCoreFoundationRoutes(
  services: BackendCoreServices,
  afterInitialize?: (initializedBy: string | null) => Promise<void>,
  synchronizeModuleRegistry?: (actorId: string | null) => Promise<void>,
  beforeInitialize?: () => Promise<void>,
) {
  const routes = new Hono();

  routes.route("/", createInitializationRoutes(services, afterInitialize, beforeInitialize));
  routes.route("/", createAuthRoutes(services));
  routes.route("/", createProfileRoutes(services));
  routes.route("/", createOrganizationRoutes(services));
  routes.route("/", createUserRoutes(services));
  routes.route("/", createRoleRoutes(services, synchronizeModuleRegistry));
  routes.route("/", createMenuRoutes(services));
  routes.route("/", createRouteMetadataRoutes(services, synchronizeModuleRegistry));

  return routes.route("/", createPermissionExtensionRoutes(services));
}
