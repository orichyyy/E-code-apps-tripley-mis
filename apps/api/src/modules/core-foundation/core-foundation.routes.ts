import { Hono } from "hono";

import { createAuthRoutes } from "./auth.routes";
import { createInitializationRoutes } from "./initialization.routes";
import { createOrganizationRoutes } from "./organization.routes";
import { createRoleRoutes } from "./role.routes";
import { createUserRoutes } from "./user.routes";
import type { BackendCoreServices } from "./services";

export function createCoreFoundationRoutes(services: BackendCoreServices) {
  const routes = new Hono();

  routes.route("/", createInitializationRoutes(services));
  routes.route("/", createAuthRoutes(services));
  routes.route("/", createOrganizationRoutes(services));
  routes.route("/", createUserRoutes(services));
  routes.route("/", createRoleRoutes(services));

  return routes;
}
