import { jsonParam, type DatabaseAdapterExecutor } from "@web-admin-base/adapters";
import {
  baseApiPermissionManifest,
  baseMenuManifest,
  basePermissionManifest,
  baseRouteManifest,
} from "@web-admin-base/contracts";
import { sha256 } from "@web-admin-base/module-sdk";

import { splitPermissionCode } from "./metadata-writer-helpers";

export class BaseMetadataWriter {
  constructor(private readonly executor: DatabaseAdapterExecutor) {}

  async synchronize(now: string): Promise<void> {
    await this.synchronizePermissions(now);
    await this.synchronizeApis(now);
    await this.synchronizeRoutes(now);
    await this.synchronizeMenus(now);
  }

  private async synchronizePermissions(now: string) {
    await this.disableMissing(
      "permissions",
      "code",
      basePermissionManifest.map((entry) => entry.code),
      now,
    );
    for (const entry of basePermissionManifest) {
      const { resource, action } = splitPermissionCode(entry.code);
      await this.executor.run(
        `INSERT INTO permissions (code, name, permission_type, resource, action, description, module, source, manifest_hash, status, created_at, updated_at)
         VALUES (${this.values(12)})
         ON CONFLICT(code) DO UPDATE SET name = excluded.name, permission_type = excluded.permission_type,
           resource = excluded.resource, action = excluded.action, description = excluded.description,
           module = excluded.module, source = 'base_manifest', manifest_hash = excluded.manifest_hash,
           status = 'enabled', updated_at = excluded.updated_at`,
        [
          entry.code,
          entry.code,
          "action",
          resource,
          action,
          entry.description,
          entry.module,
          "base_manifest",
          sha256(entry),
          "enabled",
          now,
          now,
        ],
      );
    }
  }

  private async synchronizeApis(now: string) {
    await this.disableMissing(
      "api_permissions",
      "code",
      baseApiPermissionManifest.map((entry) => entry.code),
      now,
    );
    for (const entry of baseApiPermissionManifest) {
      await this.executor.run(
        `INSERT INTO api_permissions (method, path, code, description, module, required_permission, log_level, public, source, manifest_hash, status, created_at, updated_at)
         VALUES (${this.values(13)})
         ON CONFLICT(code) DO UPDATE SET method = excluded.method, path = excluded.path,
           description = excluded.description, module = excluded.module,
           required_permission = excluded.required_permission, log_level = excluded.log_level,
           public = excluded.public, source = 'base_manifest', manifest_hash = excluded.manifest_hash,
           status = 'enabled', updated_at = excluded.updated_at`,
        [
          entry.method,
          entry.path,
          entry.code,
          entry.description,
          entry.module,
          entry.requiredPermission ?? null,
          entry.logLevel,
          this.boolean(entry.public),
          "base_manifest",
          sha256(entry),
          "enabled",
          now,
          now,
        ],
      );
    }
  }

  private async synchronizeRoutes(now: string) {
    await this.disableMissing(
      "route_metadata",
      "route_code",
      baseRouteManifest.map((entry) => entry.routeCode),
      now,
    );
    for (const entry of baseRouteManifest) {
      const metadata = {
        menuVisible: entry.menuVisible,
        icon: entry.icon ?? null,
        sortOrder: entry.sortOrder ?? 0,
      };
      await this.executor.run(
        `INSERT INTO route_metadata (route_code, path, title_i18n_key, required_permission, metadata_json, manifest_hash, menu_visible, icon, sort_order, status, source, owner_module, created_at, updated_at)
         VALUES (${this.values(14)})
         ON CONFLICT(route_code) DO UPDATE SET path = excluded.path,
           title_i18n_key = excluded.title_i18n_key, required_permission = excluded.required_permission,
           metadata_json = excluded.metadata_json, manifest_hash = excluded.manifest_hash,
           menu_visible = excluded.menu_visible, icon = excluded.icon, sort_order = excluded.sort_order,
           status = 'enabled', source = 'base_manifest', owner_module = NULL,
           updated_at = excluded.updated_at`,
        [
          entry.routeCode,
          entry.path,
          entry.titleI18nKey,
          entry.requiredPermission ?? null,
          jsonParam(metadata, this.executor.dialect),
          sha256(entry),
          this.boolean(entry.menuVisible),
          entry.icon ?? null,
          entry.sortOrder ?? 0,
          "enabled",
          "base_manifest",
          null,
          now,
          now,
        ],
      );
    }
  }

  private async synchronizeMenus(now: string) {
    await this.disableMissing(
      "menus",
      "code",
      baseMenuManifest.map((entry) => entry.code),
      now,
    );
    const idsByCode = new Map<string, string>();
    for (const entry of baseMenuManifest) {
      const parentId = entry.parentCode
        ? (idsByCode.get(entry.parentCode) ?? (await this.findMenuId(entry.parentCode)))
        : null;
      await this.executor.run(
        `INSERT INTO menus (parent_menu_id, permission_code, code, route_code, title_i18n_key, path, icon, sort_order, visible, status, source, owner_module, is_deleted, created_at, updated_at)
         VALUES (${this.values(15)})
         ON CONFLICT(code) DO UPDATE SET parent_menu_id = excluded.parent_menu_id,
           permission_code = excluded.permission_code, route_code = excluded.route_code,
           title_i18n_key = excluded.title_i18n_key, path = excluded.path, icon = excluded.icon,
           sort_order = excluded.sort_order, visible = excluded.visible, status = 'enabled',
           source = 'base_manifest', owner_module = NULL, is_deleted = excluded.is_deleted,
           deleted_at = NULL, deleted_by = NULL, updated_at = excluded.updated_at`,
        [
          parentId,
          entry.requiredPermission ?? null,
          entry.code,
          entry.routeCode ?? null,
          entry.titleI18nKey,
          entry.path,
          null,
          entry.sortOrder,
          this.boolean(entry.visible ?? true),
          "enabled",
          "base_manifest",
          null,
          this.boolean(false),
          now,
          now,
        ],
      );
      const id = await this.findMenuId(entry.code);
      if (id) idsByCode.set(entry.code, id);
    }
  }

  private async disableMissing(table: string, column: string, active: string[], now: string) {
    const placeholders = active.map((_, index) => this.p(index + 2)).join(", ");
    await this.executor.run(
      `UPDATE ${table} SET status = 'disabled', updated_at = ${this.p(1)}
       WHERE source = 'base_manifest' AND ${column} NOT IN (${placeholders})`,
      [now, ...active],
    );
  }

  private async findMenuId(code: string): Promise<string | null> {
    const rows = await this.executor.all(`SELECT id FROM menus WHERE code = ${this.p(1)} LIMIT 1`, [
      code,
    ]);
    return rows[0] ? String(rows[0].id) : null;
  }

  private p(index: number): string {
    return this.executor.dialect === "postgresql" ? `$${index}` : "?";
  }

  private values(count: number): string {
    return Array.from({ length: count }, (_, index) => this.p(index + 1)).join(", ");
  }

  private boolean(value: boolean): boolean | number {
    return this.executor.dialect === "postgresql" ? value : value ? 1 : 0;
  }
}
