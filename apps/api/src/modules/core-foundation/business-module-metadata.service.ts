import type { BusinessModuleDefinition } from "@web-admin-base/contracts";
import { sha256 } from "@web-admin-base/module-sdk";

import { nowUtc, toUtcIso } from "../../core/time/utc";
import type {
  ApiPermissionRecord,
  MenuRecord,
  PermissionRecord,
  RouteMetadataRecord,
} from "./domain";
import type { BackendCoreContext } from "./service-context";

export class BusinessModuleMetadataService {
  constructor(private readonly context: BackendCoreContext) {}

  synchronize(definitions: BusinessModuleDefinition[]): void {
    const now = toUtcIso(nowUtc());
    this.disableExisting(now);
    for (const definition of definitions) {
      this.synchronizePermissions(definition, now);
      this.synchronizeApis(definition, now);
      this.synchronizeRoutes(definition, now);
      this.synchronizeMenus(definition, now);
    }
    this.pruneAuthorizationBindings();
  }

  private disableExisting(now: string): void {
    for (const permission of this.context.store.permissions.values()) {
      if (permission.source === "business_module")
        Object.assign(permission, { status: "disabled", updatedAt: now });
    }
    for (const api of this.context.store.apiPermissions.values()) {
      if (api.source === "business_module")
        Object.assign(api, { status: "disabled", updatedAt: now });
    }
    for (const route of this.context.store.routeMetadata.values()) {
      if (route.source === "business_module")
        Object.assign(route, { status: "disabled", updatedAt: now });
    }
    for (const menu of this.context.store.menus.values()) {
      if (menu.source === "business_module")
        Object.assign(menu, { status: "disabled", updatedAt: now });
    }
  }

  private synchronizePermissions(definition: BusinessModuleDefinition, now: string): void {
    for (const contribution of definition.contributions.permissions) {
      const existing = findBy(this.context.store.permissions, "code", contribution.code);
      const { resource, action } = splitPermissionCode(contribution.code);
      const values = {
        code: contribution.code,
        name: contribution.code,
        permissionType: contribution.permissionType,
        resource,
        action,
        description: contribution.description.defaultMessage,
        module: definition.moduleCode,
        source: "business_module",
        manifestHash: sha256(contribution),
        status: "enabled" as const,
        updatedAt: now,
      };
      if (existing) Object.assign(existing, values);
      else {
        const record: PermissionRecord = {
          id: this.context.store.nextId("permission"),
          tenantId: null,
          ...values,
          createdAt: now,
        };
        this.context.store.permissions.set(record.id, record);
      }
    }
  }

  private synchronizeApis(definition: BusinessModuleDefinition, now: string): void {
    for (const contribution of definition.contributions.apis) {
      const existing = findBy(this.context.store.apiPermissions, "code", contribution.code);
      const values = {
        method: contribution.method,
        path: contribution.path,
        code: contribution.code,
        description: contribution.description.defaultMessage,
        module: definition.moduleCode,
        requiredPermission: contribution.requiredPermission,
        logLevel: contribution.logLevel,
        public: false,
        source: "business_module",
        manifestHash: sha256(contribution),
        status: "enabled" as const,
        updatedAt: now,
      };
      if (existing) Object.assign(existing, values);
      else {
        const record: ApiPermissionRecord = {
          id: this.context.store.nextId("apiPermission"),
          tenantId: null,
          ...values,
          createdAt: now,
        };
        this.context.store.apiPermissions.set(record.id, record);
      }
    }
  }

  private synchronizeRoutes(definition: BusinessModuleDefinition, now: string): void {
    for (const contribution of definition.contributions.routes) {
      const existing = findBy(
        this.context.store.routeMetadata,
        "routeCode",
        contribution.routeCode,
      );
      const metadataJson = {
        menuVisible: contribution.menuVisible,
        icon: null,
        sortOrder: contribution.sortOrder ?? 0,
      };
      const values = {
        routeCode: contribution.routeCode,
        path: contribution.path,
        titleI18nKey: contribution.title.key,
        requiredPermission: contribution.requiredPermission,
        metadataJson,
        manifestHash: sha256(contribution),
        menuVisible: contribution.menuVisible,
        icon: null,
        sortOrder: contribution.sortOrder ?? 0,
        status: "enabled" as const,
        source: "business_module",
        ownerModule: definition.moduleCode,
        updatedAt: now,
      };
      if (existing) Object.assign(existing, values);
      else {
        const record: RouteMetadataRecord = {
          id: this.context.store.nextId("routeMetadata"),
          tenantId: null,
          ...values,
          createdAt: now,
        };
        this.context.store.routeMetadata.set(record.id, record);
      }
    }
  }

  private synchronizeMenus(definition: BusinessModuleDefinition, now: string): void {
    for (const contribution of definition.contributions.menus) {
      const existing = findBy(this.context.store.menus, "code", contribution.code);
      const parent = contribution.parentCode
        ? findBy(this.context.store.menus, "code", contribution.parentCode)
        : undefined;
      const values = {
        parentMenuId: parent?.id ?? null,
        code: contribution.code,
        titleI18nKey: contribution.title.key,
        path: contribution.path,
        requiredPermission: contribution.requiredPermission ?? null,
        routeCode: contribution.routeCode ?? null,
        icon: null,
        sortOrder: contribution.sortOrder,
        visible: contribution.visible ?? true,
        status: "enabled" as const,
        source: "business_module",
        ownerModule: definition.moduleCode,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        updatedAt: now,
      };
      if (existing) Object.assign(existing, values);
      else {
        const record: MenuRecord = {
          id: this.context.store.nextId("menu"),
          tenantId: null,
          ...values,
          createdAt: now,
        };
        this.context.store.menus.set(record.id, record);
      }
    }
  }

  private pruneAuthorizationBindings(): void {
    const enabledCodes = new Set(
      [...this.context.store.permissions.values()]
        .filter((permission) => permission.status === "enabled")
        .map((permission) => permission.code),
    );
    const retainedRolePermissions = this.context.store.rolePermissions.filter((binding) =>
      enabledCodes.has(binding.permissionCode),
    );
    this.context.store.rolePermissions.splice(
      0,
      this.context.store.rolePermissions.length,
      ...retainedRolePermissions,
    );
    for (const [id, record] of this.context.store.roleDataPermissions) {
      if (!enabledCodes.has(record.permissionCode))
        this.context.store.roleDataPermissions.delete(id);
    }
    for (const [id, record] of this.context.store.userPermissionOverrides) {
      if (!enabledCodes.has(record.permissionCode))
        this.context.store.userPermissionOverrides.delete(id);
    }
    const enabledApiIds = new Set(
      [...this.context.store.apiPermissions.values()]
        .filter((api) => api.status === "enabled")
        .map((api) => api.id),
    );
    for (const [id, binding] of this.context.store.menuApiBindings) {
      if (!enabledApiIds.has(binding.apiPermissionId))
        this.context.store.menuApiBindings.delete(id);
    }
  }
}

function findBy<T, K extends keyof T>(records: Map<string, T>, key: K, value: T[K]): T | undefined {
  return [...records.values()].find((record) => record[key] === value);
}

function splitPermissionCode(code: string): { resource: string; action: string } {
  const separator = code.indexOf(":");
  return separator < 0
    ? { resource: code, action: "" }
    : { resource: code.slice(0, separator), action: code.slice(separator + 1) };
}
