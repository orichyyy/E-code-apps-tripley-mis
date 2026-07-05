import type { AdminRouteMetadata } from "@web-admin-base/contracts";
import { createHash } from "node:crypto";

import { nowUtc, toUtcIso } from "../../core/time/utc";
import { createKnownError } from "../../core/errors/error-codes";
import type { RouteMetadataRecord } from "./domain";
import type { BackendCoreContext } from "./service-context";

export type RouteMetadataListFilters = {
  keyword?: string;
  menuVisible?: boolean;
  path?: string;
  requiredPermission?: string;
  routeCode?: string;
  status?: RouteMetadataRecord["status"];
};

export class RouteMetadataService {
  constructor(private readonly context: BackendCoreContext) {}

  list(filters: RouteMetadataListFilters = {}): RouteMetadataRecord[] {
    if (filters.status !== undefined && !isEntityStatus(filters.status)) {
      throw createKnownError("VALIDATION_INVALID_REQUEST");
    }

    const keyword = filters.keyword?.trim().toLocaleLowerCase();
    const path = filters.path?.trim().toLocaleLowerCase();
    const requiredPermission = filters.requiredPermission?.trim().toLocaleLowerCase();
    const routeCode = filters.routeCode?.trim().toLocaleLowerCase();

    return [...this.context.store.routeMetadata.values()]
      .filter((route) => filters.status === undefined || route.status === filters.status)
      .filter(
        (route) => filters.menuVisible === undefined || route.menuVisible === filters.menuVisible,
      )
      .filter((route) => path === undefined || route.path.toLocaleLowerCase() === path)
      .filter(
        (route) =>
          requiredPermission === undefined ||
          route.requiredPermission?.toLocaleLowerCase() === requiredPermission,
      )
      .filter(
        (route) => routeCode === undefined || route.routeCode.toLocaleLowerCase() === routeCode,
      )
      .filter((route) => keyword === undefined || matchesRouteMetadataKeyword(route, keyword))
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  }

  syncBaseRoutes(manifest: AdminRouteMetadata[]): RouteMetadataRecord[] {
    const currentRouteCodes = new Set(manifest.map((entry) => entry.routeCode));
    const now = toUtcIso(nowUtc());
    for (const route of this.context.store.routeMetadata.values()) {
      if (!currentRouteCodes.has(route.routeCode)) {
        route.status = "disabled";
        route.updatedAt = now;
      }
    }
    return manifest.map((entry) => this.upsertManifestEntry(entry));
  }

  private upsertManifestEntry(entry: AdminRouteMetadata): RouteMetadataRecord {
    const existing = [...this.context.store.routeMetadata.values()].find(
      (route) => route.routeCode === entry.routeCode,
    );
    const metadataJson = getRouteManifestMetadata(entry);
    const manifestHash = hashRouteManifestEntry(entry);
    const now = toUtcIso(nowUtc());
    if (existing) {
      existing.path = entry.path;
      existing.titleI18nKey = entry.titleI18nKey;
      existing.requiredPermission = entry.requiredPermission ?? null;
      existing.metadataJson = metadataJson;
      existing.manifestHash = manifestHash;
      existing.menuVisible = entry.menuVisible;
      existing.icon = entry.icon ?? null;
      existing.sortOrder = entry.sortOrder ?? 0;
      existing.status = "enabled";
      existing.updatedAt = now;
      return existing;
    }

    const route: RouteMetadataRecord = {
      id: this.context.store.nextId("routeMetadata"),
      tenantId: null,
      routeCode: entry.routeCode,
      path: entry.path,
      titleI18nKey: entry.titleI18nKey,
      requiredPermission: entry.requiredPermission ?? null,
      metadataJson,
      manifestHash,
      menuVisible: entry.menuVisible,
      icon: entry.icon ?? null,
      sortOrder: entry.sortOrder ?? 0,
      status: "enabled",
      createdAt: now,
      updatedAt: now,
    };
    this.context.store.routeMetadata.set(route.id, route);
    return route;
  }
}

function isEntityStatus(status: string): status is RouteMetadataRecord["status"] {
  return status === "enabled" || status === "disabled";
}

function matchesRouteMetadataKeyword(route: RouteMetadataRecord, keyword: string): boolean {
  return [route.routeCode, route.path, route.titleI18nKey, route.requiredPermission ?? ""].some(
    (value) => value.toLocaleLowerCase().includes(keyword),
  );
}

function getRouteManifestMetadata(entry: AdminRouteMetadata): Record<string, unknown> {
  return {
    menuVisible: entry.menuVisible,
    icon: entry.icon ?? null,
    sortOrder: entry.sortOrder ?? 0,
  };
}

function hashRouteManifestEntry(entry: AdminRouteMetadata): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        routeCode: entry.routeCode,
        path: entry.path,
        titleI18nKey: entry.titleI18nKey,
        requiredPermission: entry.requiredPermission ?? null,
        metadataJson: getRouteManifestMetadata(entry),
      }),
    )
    .digest("hex");
}
