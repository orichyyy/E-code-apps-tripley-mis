import { initializationSetupRequestSchema } from "@web-admin-base/contracts";
import { pathToFileURL } from "node:url";

import { createInMemoryBackendCoreServices } from "./modules/core-foundation/services";

export type SeedEnvironment = Record<string, string | undefined>;

export function readInitializationSeedInput(env: SeedEnvironment) {
  const adminPassword = env.WEB_ADMIN_SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("WEB_ADMIN_SEED_ADMIN_PASSWORD is required for seed initialization.");
  }

  return initializationSetupRequestSchema.parse({
    organizationName: env.WEB_ADMIN_SEED_ORGANIZATION_NAME ?? "Default Organization",
    organizationCode: env.WEB_ADMIN_SEED_ORGANIZATION_CODE ?? "default",
    adminUsername: env.WEB_ADMIN_SEED_ADMIN_USERNAME ?? "admin",
    adminDisplayName: env.WEB_ADMIN_SEED_ADMIN_DISPLAY_NAME ?? "Super Admin",
    adminEmail: env.WEB_ADMIN_SEED_ADMIN_EMAIL ?? "admin@example.com",
    adminPhone: env.WEB_ADMIN_SEED_ADMIN_PHONE ?? "10000000000",
    adminPassword
  });
}

export async function runInitializationSeed(env: SeedEnvironment = process.env) {
  const services = createInMemoryBackendCoreServices();
  const result = await services.seedInitialization(readInitializationSeedInput(env));

  return {
    initialized: result.state.status === "initialized",
    seeded: result.seeded,
    organizationId: result.organization?.id ?? null,
    adminId: result.admin?.id ?? null,
    roleCount: result.roles.length,
    permissionCount: result.permissions.length,
    apiPermissionCount: result.apiPermissions.length,
    menuCount: result.menus.length,
    routeCount: result.routes.length
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runInitializationSeed()
    .then((summary) => {
      console.log(JSON.stringify({ data: summary }, null, 2));
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Seed initialization failed.";
      console.error(message);
      process.exitCode = 1;
    });
}
