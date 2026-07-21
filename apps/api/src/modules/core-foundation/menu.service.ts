import type {
  BaseMenuManifestEntry,
  CreateMenuRequest,
  UpdateMenuApiBindingsRequest,
  UpdateMenuRequest,
} from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import { nowUtc, toUtcIso } from "../../core/time/utc";
import type { MenuApiBindingRecord, MenuRecord, PublicMenuTreeNode } from "./domain";
import type { BackendCoreContext } from "./service-context";
import { requireMenu } from "./store-guards";

export class MenuService {
  constructor(private readonly context: BackendCoreContext) {}

  list(): MenuRecord[] {
    return [...this.context.store.menus.values()]
      .filter((menu) => !menu.isDeleted)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  }

  listTree(): PublicMenuTreeNode[] {
    const menus = this.list();
    const nodesById = new Map<string, PublicMenuTreeNode>();
    const roots: PublicMenuTreeNode[] = [];

    for (const menu of menus) {
      nodesById.set(menu.id, { ...menu, children: [] });
    }

    for (const menu of menus) {
      const node = nodesById.get(menu.id);
      if (!node) continue;
      const parent = menu.parentMenuId ? nodesById.get(menu.parentMenuId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  create(input: CreateMenuRequest): MenuRecord {
    return this.createRecord(input);
  }

  createRecord(input: CreateMenuRequest): MenuRecord {
    this.ensureParentExists(input.parentMenuId ?? null);
    this.ensureUniqueMenuCode(input.code);
    this.ensureUniqueMenuPath(input.path);
    this.ensureKnownPermission(input.requiredPermission ?? null);
    this.ensureKnownRoute(input.routeCode ?? null);

    const now = toUtcIso(nowUtc());
    const menu: MenuRecord = {
      id: this.context.store.nextId("menu"),
      tenantId: null,
      parentMenuId: input.parentMenuId ?? null,
      code: input.code,
      titleI18nKey: input.titleI18nKey,
      path: input.path,
      requiredPermission: input.requiredPermission ?? null,
      routeCode: input.routeCode ?? null,
      icon: input.icon ?? null,
      sortOrder: input.sortOrder ?? 0,
      visible: input.visible ?? true,
      status: input.status ?? "enabled",
      source: "manual",
      ownerModule: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    this.context.store.menus.set(menu.id, menu);
    return menu;
  }

  update(id: string, input: UpdateMenuRequest): MenuRecord {
    const menu = requireMenu(this.context.store, id);
    if (input.parentMenuId !== undefined) this.ensureParentUpdateIsValid(id, input.parentMenuId);
    if (input.code !== undefined) this.ensureUniqueMenuCode(input.code, id);
    if (input.path !== undefined) this.ensureUniqueMenuPath(input.path, id);
    if (input.requiredPermission !== undefined)
      this.ensureKnownPermission(input.requiredPermission);
    if (input.routeCode !== undefined) this.ensureKnownRoute(input.routeCode);

    if (input.parentMenuId !== undefined) menu.parentMenuId = input.parentMenuId;
    if (input.code !== undefined) menu.code = input.code;
    if (input.titleI18nKey !== undefined) menu.titleI18nKey = input.titleI18nKey;
    if (input.path !== undefined) menu.path = input.path;
    if (input.requiredPermission !== undefined) menu.requiredPermission = input.requiredPermission;
    if (input.routeCode !== undefined) menu.routeCode = input.routeCode;
    if (input.icon !== undefined) menu.icon = input.icon;
    if (input.sortOrder !== undefined) menu.sortOrder = input.sortOrder;
    if (input.visible !== undefined) menu.visible = input.visible;
    if (input.status !== undefined) menu.status = input.status;
    menu.updatedAt = toUtcIso(nowUtc());
    return menu;
  }

  delete(id: string, deletedBy: string | null = null): MenuRecord {
    const menu = requireMenu(this.context.store, id);
    const now = toUtcIso(nowUtc());
    const affectedMenus = [menu, ...this.findDescendantMenus(id)];
    for (const affectedMenu of affectedMenus) {
      affectedMenu.isDeleted = true;
      affectedMenu.status = "disabled";
      affectedMenu.deletedAt = now;
      affectedMenu.deletedBy = deletedBy;
      affectedMenu.updatedAt = now;
    }
    this.deleteApiBindingsForMenus(affectedMenus.map((affectedMenu) => affectedMenu.id));
    return menu;
  }

  updateApiBindings(id: string, input: UpdateMenuApiBindingsRequest) {
    const menu = requireMenu(this.context.store, id);
    const apiPermissionIds = [...new Set(input.apiPermissionIds)];
    const now = toUtcIso(nowUtc());

    for (const apiPermissionId of apiPermissionIds) {
      this.ensureEnabledApiPermission(apiPermissionId);
    }

    for (const [bindingId, binding] of this.context.store.menuApiBindings.entries()) {
      if (binding.menuId === menu.id) {
        this.context.store.menuApiBindings.delete(bindingId);
      }
    }

    const bindings = apiPermissionIds.map((apiPermissionId) => {
      const binding: MenuApiBindingRecord = {
        id: this.context.store.nextId("menuApiBinding"),
        tenantId: null,
        menuId: menu.id,
        apiPermissionId,
        createdAt: now,
      };
      this.context.store.menuApiBindings.set(binding.id, binding);
      return binding;
    });

    return {
      menuId: menu.id,
      apiPermissionIds,
      bindings,
    };
  }

  seedBaseMenus(manifest: BaseMenuManifestEntry[]): MenuRecord[] {
    const byCode = new Map<string, MenuRecord>();
    const seeded: MenuRecord[] = [];

    for (const entry of manifest) {
      const existing = this.findExistingBaseMenu(entry);
      const parentMenuId = entry.parentCode ? byCode.get(entry.parentCode)?.id : undefined;
      if (existing) {
        existing.code = entry.code;
        existing.parentMenuId = parentMenuId ?? null;
        existing.titleI18nKey = entry.titleI18nKey;
        existing.path = entry.path;
        existing.requiredPermission = entry.requiredPermission ?? null;
        existing.routeCode = entry.routeCode ?? null;
        existing.sortOrder = entry.sortOrder;
        existing.visible = entry.visible ?? true;
        existing.status = "enabled";
        existing.source = "base_manifest";
        existing.ownerModule = null;
        existing.isDeleted = false;
        existing.deletedAt = null;
        existing.deletedBy = null;
        existing.updatedAt = toUtcIso(nowUtc());
        byCode.set(existing.code, existing);
        seeded.push(existing);
        continue;
      }

      const menu = this.createRecord({
        parentMenuId,
        code: entry.code,
        titleI18nKey: entry.titleI18nKey,
        path: entry.path,
        requiredPermission: entry.requiredPermission,
        routeCode: entry.routeCode,
        sortOrder: entry.sortOrder,
        visible: entry.visible,
      });
      menu.source = "base_manifest";
      byCode.set(menu.code, menu);
      seeded.push(menu);
    }

    return seeded;
  }

  private findExistingBaseMenu(entry: BaseMenuManifestEntry): MenuRecord | undefined {
    return (
      [...this.context.store.menus.values()].find((menu) => menu.code === entry.code) ??
      [...this.context.store.menus.values()].find((menu) => menu.path === entry.path)
    );
  }

  private ensureParentExists(parentMenuId: string | null): void {
    if (parentMenuId !== null) requireMenu(this.context.store, parentMenuId);
  }

  private ensureParentUpdateIsValid(id: string, parentMenuId: string | null): void {
    if (parentMenuId === null) return;
    if (parentMenuId === id) throw createKnownError("VALIDATION_INVALID_REQUEST");
    requireMenu(this.context.store, parentMenuId);
    if (this.isDescendantMenu(parentMenuId, id)) {
      throw createKnownError("VALIDATION_INVALID_REQUEST");
    }
  }

  private isDescendantMenu(candidateId: string, ancestorId: string): boolean {
    const visited = new Set<string>();
    let current = this.context.store.menus.get(candidateId);
    while (current?.parentMenuId) {
      if (current.parentMenuId === ancestorId) return true;
      if (visited.has(current.parentMenuId)) return true;
      visited.add(current.parentMenuId);
      current = this.context.store.menus.get(current.parentMenuId);
    }
    return false;
  }

  private findDescendantMenus(parentId: string): MenuRecord[] {
    return [...this.context.store.menus.values()].filter(
      (menu) => !menu.isDeleted && this.isDescendantMenu(menu.id, parentId),
    );
  }

  private ensureUniqueMenuCode(code: string, currentMenuId?: string): void {
    const duplicate = [...this.context.store.menus.values()].some(
      (menu) => menu.id !== currentMenuId && menu.code === code,
    );
    if (duplicate) throw createKnownError("VALIDATION_DUPLICATE_MENU_CODE");
  }

  private ensureUniqueMenuPath(path: string, currentMenuId?: string): void {
    const duplicate = [...this.context.store.menus.values()].some(
      (menu) => menu.id !== currentMenuId && menu.path === path,
    );
    if (duplicate) throw createKnownError("VALIDATION_DUPLICATE_MENU_PATH");
  }

  private ensureKnownPermission(permissionCode: string | null): void {
    if (permissionCode === null) return;
    const permission = [...this.context.store.permissions.values()].find(
      (candidate) => candidate.code === permissionCode && candidate.status === "enabled",
    );
    if (!permission) throw createKnownError("PERMISSION_UNKNOWN_CODE");
  }

  private ensureKnownRoute(routeCode: string | null): void {
    if (routeCode === null) return;
    const route = [...this.context.store.routeMetadata.values()].find(
      (candidate) => candidate.routeCode === routeCode && candidate.status === "enabled",
    );
    if (!route) throw createKnownError("VALIDATION_INVALID_REQUEST");
  }

  private ensureEnabledApiPermission(apiPermissionId: string): void {
    const apiPermission = this.context.store.apiPermissions.get(apiPermissionId);
    if (!apiPermission || apiPermission.status !== "enabled") {
      throw createKnownError("VALIDATION_INVALID_REQUEST");
    }
  }

  private deleteApiBindingsForMenus(menuIds: string[]): void {
    const affectedMenuIds = new Set(menuIds);
    for (const [bindingId, binding] of this.context.store.menuApiBindings.entries()) {
      if (affectedMenuIds.has(binding.menuId)) {
        this.context.store.menuApiBindings.delete(bindingId);
      }
    }
  }
}
