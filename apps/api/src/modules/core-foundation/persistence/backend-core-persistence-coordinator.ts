import type { WebhookOutboxEvent } from "@web-admin-base/contracts";

import type { InMemoryBackendStore } from "../in-memory-store";
import type { BackendCoreStoreRepository } from "./backend-core-store-repository";

export type PersistenceScope =
  | "all"
  | "authSessions"
  | "initializationState"
  | "menus"
  | "organizations"
  | "permissions"
  | "permissionExtensions"
  | "roles"
  | "routeMetadata"
  | "userOrganizationRoles"
  | "userPreferences"
  | "users";

export class BackendCorePersistenceCoordinator {
  private pendingSave: Promise<void> = Promise.resolve();

  constructor(
    private readonly repository: BackendCoreStoreRepository,
    private readonly getStore: () => InMemoryBackendStore,
  ) {}

  async persistAfter<T>(
    operation: () => T | Promise<T>,
    scopes: PersistenceScope[],
    eventFactory?: (result: Awaited<T>) => WebhookOutboxEvent | null,
  ): Promise<Awaited<T>> {
    const result = await operation();
    await this.persistNow(scopes, eventFactory?.(result) ?? null);
    return result;
  }

  persistSync<T>(operation: () => T, scopes: PersistenceScope[]): T {
    const result = operation();
    this.pendingSave = this.pendingSave.then(() => this.persistScopes(scopes));
    return result;
  }

  flush(): Promise<void> {
    return this.pendingSave;
  }

  private async persistNow(
    scopes: PersistenceScope[],
    event: WebhookOutboxEvent | null,
  ): Promise<void> {
    await this.flush();
    const save = this.persistScopes(scopes, event);
    this.pendingSave = save.catch(() => undefined);
    await save;
  }

  private async persistScopes(
    scopes: PersistenceScope[],
    event: WebhookOutboxEvent | null = null,
  ): Promise<void> {
    const normalizedScopes = scopes.includes("all")
      ? (["all"] as PersistenceScope[])
      : [...new Set(scopes)];

    await this.repository.transaction(async () => {
      for (const scope of normalizedScopes) await this.persistScope(scope);
      if (event) await this.repository.appendWebhookEvent(event);
    });
  }

  private async persistScope(scope: PersistenceScope): Promise<void> {
    const store = this.getStore();
    const aggregates = this.repository.aggregates;
    switch (scope) {
      case "all":
        return aggregates.replaceAllFromStore(store);
      case "authSessions":
        return aggregates.authSessions.replaceFromStore(store);
      case "initializationState":
        return aggregates.initializationState.replaceFromStore(store);
      case "menus":
        return aggregates.menus.replaceFromStore(store);
      case "organizations":
        return aggregates.organizations.replaceFromStore(store);
      case "permissions":
        return aggregates.permissions.replaceFromStore(store);
      case "permissionExtensions":
        return aggregates.permissionExtensions.replaceFromStore(store);
      case "roles":
        return aggregates.roles.replaceFromStore(store);
      case "routeMetadata":
        return aggregates.routeMetadata.replaceFromStore(store);
      case "userOrganizationRoles":
        return aggregates.userOrganizationRoles.replaceFromStore(store);
      case "userPreferences":
        return aggregates.userPreferences.replaceFromStore(store);
      case "users":
        return aggregates.users.replaceFromStore(store);
    }
  }
}
