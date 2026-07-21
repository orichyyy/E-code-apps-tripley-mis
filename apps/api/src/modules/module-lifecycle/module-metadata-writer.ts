import { jsonParam, nowIso, type DatabaseAdapterExecutor } from "@web-admin-base/adapters";
import type { BusinessModuleDefinition } from "@web-admin-base/contracts";
import { sha256 } from "@web-admin-base/module-sdk";

import { collectModuleLocalizedMessages } from "./module-localized-messages";
import { BaseMetadataWriter } from "./base-metadata-writer";
import { splitPermissionCode } from "./metadata-writer-helpers";

export class ModuleMetadataWriter {
  private readonly baseMetadata: BaseMetadataWriter;

  constructor(private readonly executor: DatabaseAdapterExecutor) {
    this.baseMetadata = new BaseMetadataWriter(executor);
  }

  async synchronize(definitions: BusinessModuleDefinition[], acceptedAt = nowIso()): Promise<void> {
    await this.baseMetadata.synchronize(acceptedAt);
    const activeCodes = definitions.map((definition) => definition.moduleCode);
    await this.disableRemovedMetadata(activeCodes, acceptedAt);
    for (const definition of definitions) {
      await this.upsertPermissions(definition, acceptedAt);
      await this.upsertApis(definition, acceptedAt);
      await this.upsertRoutes(definition, acceptedAt);
      await this.upsertMenus(definition, acceptedAt);
      await this.upsertMessages(definition, acceptedAt);
    }
    await this.removeDisabledAuthorizationBindings();
  }

  private async disableRemovedMetadata(activeCodes: string[], now: string): Promise<void> {
    const exclusion = this.exclusion("owner_module", activeCodes, 2);
    await this.executor.run(
      `UPDATE menus SET status = 'disabled', updated_at = ${this.p(1)}
       WHERE source = 'business_module'${exclusion.sql}`,
      [now, ...exclusion.params],
    );
    await this.executor.run(
      `UPDATE route_metadata SET status = 'disabled', updated_at = ${this.p(1)}
       WHERE source = 'business_module'${exclusion.sql}`,
      [now, ...exclusion.params],
    );
    const moduleExclusion = this.exclusion("module", activeCodes, 2);
    await this.executor.run(
      `UPDATE permissions SET status = 'disabled', updated_at = ${this.p(1)}
       WHERE source = 'business_module'${moduleExclusion.sql}`,
      [now, ...moduleExclusion.params],
    );
    await this.executor.run(
      `UPDATE api_permissions SET status = 'disabled', updated_at = ${this.p(1)}
       WHERE source = 'business_module'${moduleExclusion.sql}`,
      [now, ...moduleExclusion.params],
    );
    await this.executor.run(
      `UPDATE i18n_messages SET status = 'disabled', updated_at = ${this.p(1)}
       WHERE manifest_hash IS NOT NULL${moduleExclusion.sql}`,
      [now, ...moduleExclusion.params],
    );
  }

  private async upsertPermissions(definition: BusinessModuleDefinition, now: string) {
    const activeCodes = definition.contributions.permissions.map((entry) => entry.code);
    await this.disableMissing("permissions", "code", definition.moduleCode, activeCodes, now);
    for (const entry of definition.contributions.permissions) {
      const { resource, action } = splitPermissionCode(entry.code);
      await this.executor.run(
        `INSERT INTO permissions (code, name, permission_type, resource, action, description, module, source, manifest_hash, status, created_at, updated_at)
         VALUES (${this.values(12)})
         ON CONFLICT(code) DO UPDATE SET name = excluded.name, permission_type = excluded.permission_type,
           resource = excluded.resource, action = excluded.action, description = excluded.description,
           module = excluded.module, source = excluded.source, manifest_hash = excluded.manifest_hash,
           status = 'enabled', updated_at = excluded.updated_at`,
        [
          entry.code,
          entry.code,
          entry.permissionType,
          resource,
          action,
          entry.description.defaultMessage,
          definition.moduleCode,
          "business_module",
          sha256(entry),
          "enabled",
          now,
          now,
        ],
      );
    }
  }

  private async upsertApis(definition: BusinessModuleDefinition, now: string) {
    const activeCodes = definition.contributions.apis.map((entry) => entry.code);
    await this.disableMissing("api_permissions", "code", definition.moduleCode, activeCodes, now);
    for (const entry of definition.contributions.apis) {
      await this.executor.run(
        `INSERT INTO api_permissions (method, path, code, description, module, required_permission, log_level, public, source, manifest_hash, status, created_at, updated_at)
         VALUES (${this.values(13)})
         ON CONFLICT(code) DO UPDATE SET method = excluded.method, path = excluded.path,
           description = excluded.description, module = excluded.module,
           required_permission = excluded.required_permission, log_level = excluded.log_level,
           public = excluded.public, source = excluded.source, manifest_hash = excluded.manifest_hash,
           status = 'enabled', updated_at = excluded.updated_at`,
        [
          entry.method,
          entry.path,
          entry.code,
          entry.description.defaultMessage,
          definition.moduleCode,
          entry.requiredPermission,
          entry.logLevel,
          this.boolean(false),
          "business_module",
          sha256(entry),
          "enabled",
          now,
          now,
        ],
      );
    }
  }

  private async upsertRoutes(definition: BusinessModuleDefinition, now: string) {
    const routes = definition.contributions.routes;
    await this.disableMissing(
      "route_metadata",
      "route_code",
      definition.moduleCode,
      routes.map((entry) => entry.routeCode),
      now,
      "owner_module",
    );
    for (const entry of routes) {
      const metadata = {
        menuVisible: entry.menuVisible,
        icon: null,
        sortOrder: entry.sortOrder ?? 0,
      };
      await this.executor.run(
        `INSERT INTO route_metadata (route_code, path, title_i18n_key, required_permission, metadata_json, manifest_hash, menu_visible, icon, sort_order, status, source, owner_module, created_at, updated_at)
         VALUES (${this.values(14)})
         ON CONFLICT(route_code) DO UPDATE SET path = excluded.path,
           title_i18n_key = excluded.title_i18n_key, required_permission = excluded.required_permission,
           metadata_json = excluded.metadata_json, manifest_hash = excluded.manifest_hash,
           menu_visible = excluded.menu_visible, sort_order = excluded.sort_order,
           status = 'enabled', source = excluded.source, owner_module = excluded.owner_module,
           updated_at = excluded.updated_at`,
        [
          entry.routeCode,
          entry.path,
          entry.title.key,
          entry.requiredPermission,
          jsonParam(metadata, this.executor.dialect),
          sha256(entry),
          this.boolean(entry.menuVisible),
          null,
          entry.sortOrder ?? 0,
          "enabled",
          "business_module",
          definition.moduleCode,
          now,
          now,
        ],
      );
    }
  }

  private async upsertMenus(definition: BusinessModuleDefinition, now: string) {
    const menus = definition.contributions.menus;
    await this.disableMissing(
      "menus",
      "code",
      definition.moduleCode,
      menus.map((entry) => entry.code),
      now,
      "owner_module",
    );
    for (const entry of menus) {
      const parentId = entry.parentCode ? await this.findMenuId(entry.parentCode) : null;
      await this.executor.run(
        `INSERT INTO menus (parent_menu_id, permission_code, code, route_code, title_i18n_key, path, icon, sort_order, visible, status, source, owner_module, is_deleted, created_at, updated_at)
         VALUES (${this.values(15)})
         ON CONFLICT(code) DO UPDATE SET parent_menu_id = excluded.parent_menu_id,
           permission_code = excluded.permission_code, route_code = excluded.route_code,
           title_i18n_key = excluded.title_i18n_key, path = excluded.path,
           sort_order = excluded.sort_order, visible = excluded.visible, status = 'enabled',
           source = excluded.source, owner_module = excluded.owner_module, is_deleted = excluded.is_deleted,
           deleted_at = NULL, deleted_by = NULL, updated_at = excluded.updated_at`,
        [
          parentId,
          entry.requiredPermission ?? null,
          entry.code,
          entry.routeCode ?? null,
          entry.title.key,
          entry.path,
          null,
          entry.sortOrder,
          this.boolean(entry.visible ?? true),
          "enabled",
          "business_module",
          definition.moduleCode,
          this.boolean(false),
          now,
          now,
        ],
      );
    }
  }

  private async upsertMessages(definition: BusinessModuleDefinition, now: string) {
    const messages = collectModuleLocalizedMessages(definition);
    await this.executor.run(
      `UPDATE i18n_messages SET status = 'disabled', updated_at = ${this.p(1)}
       WHERE module = ${this.p(2)} AND manifest_hash IS NOT NULL`,
      [now, definition.moduleCode],
    );
    for (const message of messages) {
      const hash = sha256(message);
      await this.executor.run(
        `INSERT INTO i18n_messages (message_key, language, message_value, default_message, override_value, module, status, manifest_hash, updated_at)
         VALUES (${this.values(9)})
         ON CONFLICT(message_key, language) DO UPDATE SET
           default_message = excluded.default_message,
           message_value = COALESCE(i18n_messages.override_value, excluded.default_message),
           module = excluded.module, status = 'enabled', manifest_hash = excluded.manifest_hash,
           updated_at = excluded.updated_at`,
        [
          message.key,
          message.language,
          message.defaultMessage,
          message.defaultMessage,
          null,
          definition.moduleCode,
          "enabled",
          hash,
          now,
        ],
      );
    }
  }

  private async disableMissing(
    table: string,
    identityColumn: string,
    moduleCode: string,
    activeIds: string[],
    now: string,
    moduleColumn = "module",
  ) {
    const exclusion = this.exclusion(identityColumn, activeIds, 3);
    await this.executor.run(
      `UPDATE ${table} SET status = 'disabled', updated_at = ${this.p(1)}
       WHERE ${moduleColumn} = ${this.p(2)} AND source = 'business_module'${exclusion.sql}`,
      [now, moduleCode, ...exclusion.params],
    );
  }

  private async removeDisabledAuthorizationBindings() {
    const disabled = `SELECT id FROM permissions WHERE source = 'business_module' AND status = 'disabled'`;
    await this.executor.run(`DELETE FROM role_permissions WHERE permission_id IN (${disabled})`);
    await this.executor.run(
      `DELETE FROM role_data_permissions WHERE permission_id IN (${disabled})`,
    );
    await this.executor.run(
      `DELETE FROM user_permission_overrides WHERE permission_id IN (${disabled})`,
    );
    await this.executor.run(
      `DELETE FROM menu_api_bindings WHERE menu_id IN
       (SELECT id FROM menus WHERE source = 'business_module' AND status = 'disabled')
       OR api_permission_id IN
       (SELECT id FROM api_permissions WHERE source = 'business_module' AND status = 'disabled')`,
    );
  }

  private async findMenuId(code: string): Promise<string | null> {
    const rows = await this.executor.all(
      `SELECT id FROM menus WHERE code = ${this.p(1)} AND status = 'enabled' LIMIT 1`,
      [code],
    );
    return rows[0] ? String(rows[0].id) : null;
  }

  private exclusion(column: string, values: string[], startIndex: number) {
    if (values.length === 0) return { sql: "", params: [] as string[] };
    return {
      sql: ` AND ${column} NOT IN (${values.map((_, index) => this.p(startIndex + index)).join(", ")})`,
      params: values,
    };
  }

  private p(index: number): string {
    return this.executor.dialect === "postgresql" ? `$${index}` : "?";
  }

  private boolean(value: boolean): boolean | number {
    return this.executor.dialect === "postgresql" ? value : value ? 1 : 0;
  }

  private values(count: number): string {
    return Array.from({ length: count }, (_, index) => this.p(index + 1)).join(", ");
  }
}
