import type { AdminRouteMetadata } from "@web-admin-base/contracts";

import { nowUtc, toUtcIso } from "../../core/time/utc";
import type { RouteMetadataRecord } from "./domain";
import type { BackendCoreContext } from "./service-context";

export class RouteMetadataService {
  constructor(private readonly context: BackendCoreContext) {}

  list(): RouteMetadataRecord[] {
    return [...this.context.store.routeMetadata.values()].sort(
      (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
    );
  }

  syncBaseRoutes(manifest: AdminRouteMetadata[]): RouteMetadataRecord[] {
    return manifest.map((entry) => this.upsertManifestEntry(entry));
  }

  private upsertManifestEntry(entry: AdminRouteMetadata): RouteMetadataRecord {
    const existing = [...this.context.store.routeMetadata.values()].find(
      (route) => route.routeCode === entry.routeCode
    );
    const now = toUtcIso(nowUtc());
    if (existing) {
      existing.path = entry.path;
      existing.titleI18nKey = entry.titleI18nKey;
      existing.requiredPermission = entry.requiredPermission ?? null;
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
      menuVisible: entry.menuVisible,
      icon: entry.icon ?? null,
      sortOrder: entry.sortOrder ?? 0,
      status: "enabled",
      createdAt: now,
      updatedAt: now
    };
    this.context.store.routeMetadata.set(route.id, route);
    return route;
  }
}
