import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBusinessModuleRegistry } from "@web-admin-base/module-sdk";
import type { DatabaseAdapterExecutor } from "@web-admin-base/adapters";
import { runSqliteMigrations } from "@web-admin-base/db";
import { afterEach, describe, expect, it } from "vitest";

import { createSqliteInfrastructureExecutor } from "../src/modules/infrastructure/infrastructure.executor";
import { ModuleLifecycleRepository } from "../src/modules/module-lifecycle/module-lifecycle.repository";
import { ModuleLifecycleService } from "../src/modules/module-lifecycle/module-lifecycle.service";
import { createLifecycleFixtureModule } from "./fixtures/business-module-definition";

const files: string[] = [];

afterEach(() => {
  for (const filename of files.splice(0)) {
    if (existsSync(filename)) rmSync(filename, { force: true });
  }
});

describe("database-backed Business Module lifecycle", () => {
  it("persists accepted metadata, preserves i18n overrides, and disables removed modules", async () => {
    const filename = join(tmpdir(), `module-lifecycle-${process.pid}-${Date.now()}.sqlite`);
    files.push(filename);
    runSqliteMigrations({ url: `file:${filename}` });
    const executor = createSqliteInfrastructureExecutor(filename);
    const repository = new ModuleLifecycleRepository(executor);
    const definition = createLifecycleFixtureModule();
    const registry = createBusinessModuleRegistry([definition]);
    const service = new ModuleLifecycleService(
      registry,
      repository,
      {},
      () => "2026-07-20T02:00:00.000Z",
    );

    try {
      await insertBaseMenu(executor);
      await service.apply({ expectedRegistryHash: registry.registryHash, confirmed: true }, null);

      expect(await service.isModuleActive(definition.moduleCode)).toBe(true);
      await expectModuleMetadataEnabled(executor);
      await executor.run(
        `INSERT INTO scheduled_jobs
          (code, cron_expression, handler_type, payload_json, status, created_at, updated_at)
         VALUES (?, '0 * * * *', 'fixture-lifecycle.reconcile', '{}', 'enabled', ?, ?)`,
        ["fixture-lifecycle.schedule", "2026-07-20T02:00:00.000Z", "2026-07-20T02:00:00.000Z"],
      );

      await executor.run(
        `UPDATE i18n_messages SET override_value = ?, message_value = ?
         WHERE message_key = ? AND language = ?`,
        ["Administrator override", "Administrator override", definition.title.key, "en"],
      );
      const presentationRegistry = createBusinessModuleRegistry([
        createLifecycleFixtureModule({ title: "Updated default" }),
      ]);
      await new ModuleLifecycleService(
        presentationRegistry,
        repository,
        {},
        () => "2026-07-20T03:00:00.000Z",
      ).apply({ expectedRegistryHash: presentationRegistry.registryHash, confirmed: true }, null);

      const i18nRows = await executor.all(
        `SELECT default_message, override_value, message_value FROM i18n_messages
         WHERE message_key = ? AND language = ?`,
        [definition.title.key, "en"],
      );
      expect(i18nRows[0]).toMatchObject({
        default_message: "Updated default",
        override_value: "Administrator override",
        message_value: "Administrator override",
      });

      const permissionRows = await executor.all(
        `SELECT id FROM permissions WHERE code = ? LIMIT 1`,
        [definition.contributions.permissions[0]?.code],
      );
      await executor.run(
        `INSERT INTO role_permissions (role_id, permission_id, effect, created_at, updated_at)
         VALUES (?, ?, 'allow', ?, ?)`,
        [
          999,
          String(permissionRows[0]?.id),
          "2026-07-20T03:00:00.000Z",
          "2026-07-20T03:00:00.000Z",
        ],
      );

      const emptyRegistry = createBusinessModuleRegistry([]);
      const removalService = new ModuleLifecycleService(
        emptyRegistry,
        repository,
        {},
        () => "2026-07-20T04:00:00.000Z",
      );
      expect((await removalService.plan()).changes[0]).toMatchObject({
        type: "disable",
        authorizationBindingsRemoved: [expect.objectContaining({ roleBindingCount: 1 })],
      });
      await removalService.apply(
        { expectedRegistryHash: emptyRegistry.registryHash, confirmed: true },
        null,
      );

      const snapshot = await repository.loadSnapshot();
      expect(snapshot.entries[0]).toMatchObject({ status: "disabled" });
      expect(
        await executor.all(
          "SELECT status, next_run_at FROM scheduled_jobs WHERE handler_type = ?",
          ["fixture-lifecycle.reconcile"],
        ),
      ).toEqual([{ status: "disabled", next_run_at: null }]);
      expect(await executor.all("SELECT id FROM role_permissions")).toEqual([]);
      expect(
        await executor.all(
          "SELECT id FROM permissions WHERE status = 'enabled' AND source = 'business_module'",
        ),
      ).toEqual([]);
      expect(
        await executor.all(
          "SELECT id FROM log_entries WHERE log_type IN ('operation', 'security')",
        ),
      ).toHaveLength(6);
    } finally {
      await repository.close();
    }
  });

  it("rolls back accepted state and metadata when transactional synchronization fails", async () => {
    const filename = join(
      tmpdir(),
      `module-lifecycle-rollback-${process.pid}-${Date.now()}.sqlite`,
    );
    files.push(filename);
    runSqliteMigrations({ url: `file:${filename}` });
    const executor = createSqliteInfrastructureExecutor(filename);
    const failingExecutor = failAuditWrites(executor);
    const repository = new ModuleLifecycleRepository(failingExecutor);
    const registry = createBusinessModuleRegistry([createLifecycleFixtureModule()]);
    const service = new ModuleLifecycleService(registry, repository);

    try {
      await expect(
        service.apply({ expectedRegistryHash: registry.registryHash, confirmed: true }, null),
      ).rejects.toThrow("injected audit failure");
      expect(await executor.all("SELECT id FROM business_module_registry_state")).toEqual([]);
      expect(
        await executor.all("SELECT id FROM permissions WHERE source = 'business_module'"),
      ).toEqual([]);
    } finally {
      await repository.close();
    }
  });
});

function failAuditWrites(executor: DatabaseAdapterExecutor): DatabaseAdapterExecutor {
  return {
    ...executor,
    async run(sql, params = []) {
      if (sql.includes("INSERT INTO log_entries")) throw new Error("injected audit failure");
      await executor.run(sql, params);
    },
    transaction: (operation) => executor.transaction(operation),
  };
}

async function insertBaseMenu(
  executor: ReturnType<typeof createSqliteInfrastructureExecutor>,
): Promise<void> {
  await executor.run(
    `INSERT INTO menus
      (code, title_i18n_key, path, sort_order, visible, status, source, is_deleted, created_at, updated_at)
     VALUES ('system', 'routes.system', '/system', 100, 1, 'enabled', 'base_manifest', 0, ?, ?)`,
    ["2026-07-20T00:00:00.000Z", "2026-07-20T00:00:00.000Z"],
  );
}

async function expectModuleMetadataEnabled(
  executor: ReturnType<typeof createSqliteInfrastructureExecutor>,
): Promise<void> {
  const counts = await Promise.all(
    [
      "SELECT COUNT(*) AS count FROM permissions WHERE source = 'business_module' AND status = 'enabled'",
      "SELECT COUNT(*) AS count FROM api_permissions WHERE source = 'business_module' AND status = 'enabled'",
      "SELECT COUNT(*) AS count FROM route_metadata WHERE source = 'business_module' AND status = 'enabled'",
      "SELECT COUNT(*) AS count FROM menus WHERE source = 'business_module' AND status = 'enabled'",
      "SELECT COUNT(*) AS count FROM i18n_messages WHERE module = 'fixture-lifecycle' AND status = 'enabled'",
    ].map(async (sql) => (await executor.all(sql))[0]?.count),
  );
  expect(counts.map(Number)).toEqual([1, 1, 1, 1, 8]);
}
