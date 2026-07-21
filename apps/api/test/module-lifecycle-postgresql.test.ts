import type { DatabaseAdapterExecutor } from "@web-admin-base/adapters";
import { runPostgresqlMigrations } from "@web-admin-base/db";
import { createBusinessModuleRegistry } from "@web-admin-base/module-sdk";
import { describe, expect, it } from "vitest";

import { createPostgresqlInfrastructureExecutor } from "../src/modules/infrastructure/infrastructure.executor";
import { ModuleLifecycleRepository } from "../src/modules/module-lifecycle/module-lifecycle.repository";
import { ModuleLifecycleService } from "../src/modules/module-lifecycle/module-lifecycle.service";
import { createLifecycleFixtureModule } from "./fixtures/business-module-definition";

const postgresqlUrl = process.env.TEST_DATABASE_URL;

describe("PostgreSQL Business Module lifecycle", () => {
  it.runIf(postgresqlUrl)(
    "persists, reloads, updates, and disables accepted release metadata",
    async () => {
      const url = getPostgresqlUrl();
      await runPostgresqlMigrations({ url });
      const executor = createPostgresqlInfrastructureExecutor(url);
      const repository = new ModuleLifecycleRepository(executor);
      const definition = createLifecycleFixtureModule();
      const registry = createBusinessModuleRegistry([definition]);
      const service = new ModuleLifecycleService(
        registry,
        repository,
        {},
        () => "2026-07-20T04:00:00.000Z",
      );

      try {
        await clearFixtureState(executor);
        const applied = await service.apply(
          { expectedRegistryHash: registry.registryHash, confirmed: true },
          null,
        );
        expect(applied.applied).toBe(true);
        expect(await service.isModuleActive(definition.moduleCode)).toBe(true);

        const reloadedRepository = new ModuleLifecycleRepository(
          createPostgresqlInfrastructureExecutor(url),
        );
        try {
          const reloadedService = new ModuleLifecycleService(registry, reloadedRepository);
          expect(await reloadedService.isModuleActive(definition.moduleCode)).toBe(true);
          expect((await reloadedService.plan()).changes).toEqual([]);
        } finally {
          await reloadedRepository.close();
        }

        await executor.run(
          `UPDATE i18n_messages SET override_value = $1, message_value = $1
           WHERE module = $2 AND message_key = $3 AND language = 'en'`,
          ["PostgreSQL override", definition.moduleCode, definition.title.key],
        );
        const presentationRegistry = createBusinessModuleRegistry([
          createLifecycleFixtureModule({ title: "Changed manifest default" }),
        ]);
        const presentationService = new ModuleLifecycleService(
          presentationRegistry,
          repository,
          {},
          () => "2026-07-20T05:00:00.000Z",
        );
        expect((await presentationService.getRegistry()).modules[0]).toMatchObject({
          state: "active",
          drift: "presentation",
        });
        await presentationService.apply(
          { expectedRegistryHash: presentationRegistry.registryHash, confirmed: true },
          null,
        );
        expect(
          await executor.all(
            `SELECT default_message, override_value, message_value FROM i18n_messages
             WHERE module = $1 AND message_key = $2 AND language = 'en'`,
            [definition.moduleCode, definition.title.key],
          ),
        ).toEqual([
          {
            default_message: "Changed manifest default",
            override_value: "PostgreSQL override",
            message_value: "PostgreSQL override",
          },
        ]);

        const emptyRegistry = createBusinessModuleRegistry([]);
        await new ModuleLifecycleService(emptyRegistry, repository).apply(
          { expectedRegistryHash: emptyRegistry.registryHash, confirmed: true },
          null,
        );
        expect((await repository.loadSnapshot()).entries[0]?.status).toBe("disabled");
        expect(await enabledFixtureMetadataCount(executor)).toBe(0);
      } finally {
        await clearFixtureState(executor);
        await repository.close();
      }
    },
  );
});

async function enabledFixtureMetadataCount(executor: DatabaseAdapterExecutor): Promise<number> {
  const rows = await executor.all(
    `SELECT
      (SELECT COUNT(*) FROM permissions WHERE module = $1 AND status = 'enabled') +
      (SELECT COUNT(*) FROM api_permissions WHERE module = $1 AND status = 'enabled') +
      (SELECT COUNT(*) FROM route_metadata WHERE owner_module = $1 AND status = 'enabled') +
      (SELECT COUNT(*) FROM menus WHERE owner_module = $1 AND status = 'enabled') +
      (SELECT COUNT(*) FROM i18n_messages WHERE module = $1 AND status = 'enabled') AS count`,
    ["fixture-lifecycle"],
  );
  return Number(rows[0]?.count);
}

async function clearFixtureState(executor: DatabaseAdapterExecutor): Promise<void> {
  const code = "fixture-lifecycle";
  await executor.run(
    `DELETE FROM menu_api_bindings WHERE menu_id IN
       (SELECT id FROM menus WHERE owner_module = $1)
       OR api_permission_id IN (SELECT id FROM api_permissions WHERE module = $1)`,
    [code],
  );
  await executor.run(
    `DELETE FROM role_permissions WHERE permission_id IN
       (SELECT id FROM permissions WHERE module = $1)`,
    [code],
  );
  await executor.run(
    `DELETE FROM role_data_permissions WHERE permission_id IN
       (SELECT id FROM permissions WHERE module = $1)`,
    [code],
  );
  await executor.run(
    `DELETE FROM user_permission_overrides WHERE permission_id IN
       (SELECT id FROM permissions WHERE module = $1)`,
    [code],
  );
  await executor.run("DELETE FROM menus WHERE owner_module = $1", [code]);
  await executor.run("DELETE FROM route_metadata WHERE owner_module = $1", [code]);
  await executor.run("DELETE FROM api_permissions WHERE module = $1", [code]);
  await executor.run("DELETE FROM permissions WHERE module = $1", [code]);
  await executor.run("DELETE FROM i18n_messages WHERE module = $1", [code]);
  await executor.run("DELETE FROM business_module_registry_entries WHERE module_code = $1", [code]);
  await executor.run("DELETE FROM business_module_registry_state WHERE singleton_key = 'current'");
  await executor.run(
    "DELETE FROM log_entries WHERE message = 'Business Module registry synchronized'",
  );
}

function getPostgresqlUrl(): string {
  if (!postgresqlUrl) throw new Error("TEST_DATABASE_URL is required.");
  return postgresqlUrl;
}
