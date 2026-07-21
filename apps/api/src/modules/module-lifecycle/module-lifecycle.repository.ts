import {
  jsonParam,
  readJson,
  type DatabaseAdapterExecutor,
  type DatabaseRow,
} from "@web-admin-base/adapters";
import {
  businessModuleDefinitionSchema,
  type BusinessModuleDefinition,
} from "@web-admin-base/contracts";
import { loadDatabaseConfig } from "@web-admin-base/db";

import {
  createPostgresqlInfrastructureExecutor,
  createSqliteInfrastructureExecutor,
} from "../infrastructure/infrastructure.executor";
import type {
  AcceptedModuleRegistrySnapshot,
  AuthorizationBindingCounts,
  ModuleLifecycleStore,
} from "./module-lifecycle.types";
import { ModuleMetadataWriter } from "./module-metadata-writer";

export class ModuleLifecycleRepository implements ModuleLifecycleStore {
  private readonly metadataWriter: ModuleMetadataWriter;

  constructor(private readonly executor: DatabaseAdapterExecutor) {
    this.metadataWriter = new ModuleMetadataWriter(executor);
  }

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): ModuleLifecycleRepository {
    const config = loadDatabaseConfig(env);
    const executor =
      config.dialect === "postgresql"
        ? createPostgresqlInfrastructureExecutor(config.url)
        : createSqliteInfrastructureExecutor(config.url);
    return new ModuleLifecycleRepository(executor);
  }

  close(): Promise<void> {
    return this.executor.close();
  }

  async loadSnapshot(): Promise<AcceptedModuleRegistrySnapshot> {
    const [stateRows, entryRows] = await Promise.all([
      this.executor.all(
        `SELECT registry_hash, accepted_at FROM business_module_registry_state
         WHERE singleton_key = 'current' LIMIT 1`,
      ),
      this.executor.all(
        `SELECT module_code, definition_json, definition_hash, activation_hash, status,
                accepted_at, accepted_by, disabled_at
         FROM business_module_registry_entries ORDER BY module_code`,
      ),
    ]);
    const state = stateRows[0];
    return {
      registryHash: state ? String(state.registry_hash) : null,
      acceptedAt: state ? iso(state.accepted_at) : null,
      entries: entryRows.map((row) => ({
        definition: parseDefinition(row.definition_json),
        definitionHash: String(row.definition_hash),
        activationHash: String(row.activation_hash),
        status: String(row.status) as "active" | "disabled",
        acceptedAt: iso(row.accepted_at),
        acceptedBy: nullableId(row.accepted_by),
        disabledAt: nullableIso(row.disabled_at),
      })),
    };
  }

  async listEnabledDictionaryTypeCodes(): Promise<Set<string>> {
    const rows = await this.executor.all(
      `SELECT code FROM dictionary_types WHERE status = 'enabled' ORDER BY code`,
    );
    return new Set(rows.map((row) => String(row.code)));
  }

  async listAuthorizationBindingCounts(
    permissionCodes: string[],
  ): Promise<AuthorizationBindingCounts[]> {
    if (permissionCodes.length === 0) return [];
    const placeholders = permissionCodes.map((_, index) => this.p(index + 1)).join(", ");
    const falseValue = this.executor.dialect === "postgresql" ? "FALSE" : "0";
    const rows = await this.executor.all(
      `SELECT p.code,
        (SELECT COUNT(*) FROM role_permissions rp WHERE rp.permission_id = p.id) AS role_count,
        (SELECT COUNT(*) FROM role_data_permissions rdp
          WHERE rdp.permission_id = p.id AND rdp.is_deleted = ${falseValue}) AS data_count,
        (SELECT COUNT(*) FROM user_permission_overrides upo
          WHERE upo.permission_id = p.id AND upo.is_deleted = ${falseValue}) AS override_count
       FROM permissions p WHERE p.code IN (${placeholders}) ORDER BY p.code`,
      permissionCodes,
    );
    return rows.map(toBindingCounts);
  }

  async applyRegistry(input: {
    registryHash: string;
    entries: Array<{
      definition: BusinessModuleDefinition;
      definitionHash: string;
      activationHash: string;
    }>;
    acceptedBy: string | null;
    acceptedAt: string;
  }): Promise<void> {
    await this.executor.transaction(async () => {
      await this.upsertRegistryState(input);
      await this.disableRemovedEntries(input);
      for (const entry of input.entries) await this.upsertEntry(entry, input);
      await this.metadataWriter.synchronize(
        input.entries.map((entry) => entry.definition),
        input.acceptedAt,
      );
      await this.writeAuditLogs(input);
    });
  }

  private async upsertRegistryState(input: {
    registryHash: string;
    acceptedBy: string | null;
    acceptedAt: string;
  }) {
    await this.executor.run(
      `INSERT INTO business_module_registry_state
         (singleton_key, registry_hash, accepted_at, accepted_by, created_at, updated_at)
       VALUES ('current', ${this.p(1)}, ${this.p(2)}, ${this.p(3)}, ${this.p(4)}, ${this.p(5)})
       ON CONFLICT(singleton_key) DO UPDATE SET registry_hash = excluded.registry_hash,
         accepted_at = excluded.accepted_at, accepted_by = excluded.accepted_by,
         updated_at = excluded.updated_at`,
      [input.registryHash, input.acceptedAt, input.acceptedBy, input.acceptedAt, input.acceptedAt],
    );
  }

  private async disableRemovedEntries(input: {
    entries: Array<{ definition: BusinessModuleDefinition }>;
    acceptedAt: string;
  }) {
    const codes = input.entries.map((entry) => entry.definition.moduleCode);
    const exclusion = codes.length
      ? ` AND module_code NOT IN (${codes.map((_, index) => this.p(index + 3)).join(", ")})`
      : "";
    const selectExclusion = codes.length
      ? ` AND module_code NOT IN (${codes.map((_, index) => this.p(index + 1)).join(", ")})`
      : "";
    const removed = await this.executor.all(
      `SELECT definition_json FROM business_module_registry_entries
       WHERE status = 'active'${selectExclusion}`,
      codes,
    );
    await this.disableRemovedModuleSchedules(
      removed.map((row) => parseDefinition(row.definition_json)),
      input.acceptedAt,
    );
    await this.executor.run(
      `UPDATE business_module_registry_entries
       SET status = 'disabled', disabled_at = ${this.p(1)}, updated_at = ${this.p(2)}
       WHERE status = 'active'${exclusion}`,
      [input.acceptedAt, input.acceptedAt, ...codes],
    );
  }

  private async disableRemovedModuleSchedules(
    definitions: BusinessModuleDefinition[],
    updatedAt: string,
  ): Promise<void> {
    const jobTypes = definitions.flatMap((definition) =>
      definition.contributions.scheduledJobs.map(({ jobType }) => jobType),
    );
    if (jobTypes.length === 0) return;
    const placeholders = jobTypes.map((_, index) => this.p(index + 2)).join(", ");
    await this.executor.run(
      `UPDATE scheduled_jobs SET status = 'disabled', next_run_at = NULL, updated_at = ${this.p(1)}
       WHERE handler_type IN (${placeholders})`,
      [updatedAt, ...jobTypes],
    );
  }

  private async upsertEntry(
    entry: {
      definition: BusinessModuleDefinition;
      definitionHash: string;
      activationHash: string;
    },
    input: { acceptedBy: string | null; acceptedAt: string },
  ) {
    await this.executor.run(
      `INSERT INTO business_module_registry_entries
         (module_code, definition_json, definition_hash, activation_hash, status,
          accepted_at, accepted_by, disabled_at, created_at, updated_at)
       VALUES (${this.values(10)})
       ON CONFLICT(module_code) DO UPDATE SET definition_json = excluded.definition_json,
         definition_hash = excluded.definition_hash, activation_hash = excluded.activation_hash,
         status = 'active', accepted_at = excluded.accepted_at, accepted_by = excluded.accepted_by,
         disabled_at = NULL, updated_at = excluded.updated_at`,
      [
        entry.definition.moduleCode,
        jsonParam(entry.definition, this.executor.dialect),
        entry.definitionHash,
        entry.activationHash,
        "active",
        input.acceptedAt,
        input.acceptedBy,
        null,
        input.acceptedAt,
        input.acceptedAt,
      ],
    );
  }

  private async writeAuditLogs(input: {
    registryHash: string;
    acceptedBy: string | null;
    acceptedAt: string;
    entries: Array<{ definition: BusinessModuleDefinition }>;
  }) {
    const metadata = jsonParam(
      {
        registryHash: input.registryHash,
        moduleCodes: input.entries.map((entry) => entry.definition.moduleCode),
      },
      this.executor.dialect,
    );
    for (const logType of ["operation", "security"] as const) {
      await this.executor.run(
        `INSERT INTO log_entries
           (log_type, level, message, user_id, metadata_json, occurred_at, created_at)
         VALUES (${this.values(7)})`,
        [
          logType,
          "info",
          "Business Module registry synchronized",
          input.acceptedBy,
          metadata,
          input.acceptedAt,
          input.acceptedAt,
        ],
      );
    }
  }

  private p(index: number): string {
    return this.executor.dialect === "postgresql" ? `$${index}` : "?";
  }

  private values(count: number): string {
    return Array.from({ length: count }, (_, index) => this.p(index + 1)).join(", ");
  }
}

function parseDefinition(value: unknown): BusinessModuleDefinition {
  return businessModuleDefinitionSchema.parse(readJson(value));
}

function toBindingCounts(row: DatabaseRow): AuthorizationBindingCounts {
  return {
    permissionCode: String(row.code),
    roleBindingCount: Number(row.role_count),
    dataRuleCount: Number(row.data_count),
    userOverrideCount: Number(row.override_count),
  };
}

function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function nullableIso(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value);
}

function nullableId(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}
