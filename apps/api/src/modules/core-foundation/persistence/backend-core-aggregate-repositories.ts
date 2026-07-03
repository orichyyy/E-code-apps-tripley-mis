import type { InMemoryBackendStore } from "../in-memory-store";
import type { QueryExecutor } from "./query-executor";
import { AuthSessionRepository } from "./auth-session.repository";
import { InitializationStateRepository } from "./initialization-state.repository";
import { MenuRepository } from "./menu.repository";
import { OrganizationRepository } from "./organization.repository";
import { PermissionExtensionRepository } from "./permission-extension.repository";
import { PermissionMetadataRepository } from "./permission-metadata.repository";
import { RoleRepository } from "./role.repository";
import { RouteMetadataRepository } from "./route-metadata.repository";
import { UserOrganizationRoleRepository } from "./user-organization-role.repository";
import { UserPreferenceRepository } from "./user-preference.repository";
import { UserRepository } from "./user.repository";

export class BackendCoreAggregateRepositories {
  readonly authSessions: AuthSessionRepository;
  readonly initializationState: InitializationStateRepository;
  readonly menus: MenuRepository;
  readonly organizations: OrganizationRepository;
  readonly permissionExtensions: PermissionExtensionRepository;
  readonly permissions: PermissionMetadataRepository;
  readonly roles: RoleRepository;
  readonly routeMetadata: RouteMetadataRepository;
  readonly userOrganizationRoles: UserOrganizationRoleRepository;
  readonly userPreferences: UserPreferenceRepository;
  readonly users: UserRepository;

  constructor(executor: QueryExecutor) {
    this.authSessions = new AuthSessionRepository(executor);
    this.initializationState = new InitializationStateRepository(executor);
    this.menus = new MenuRepository(executor);
    this.organizations = new OrganizationRepository(executor);
    this.permissionExtensions = new PermissionExtensionRepository(executor);
    this.permissions = new PermissionMetadataRepository(executor);
    this.roles = new RoleRepository(executor);
    this.routeMetadata = new RouteMetadataRepository(executor);
    this.userOrganizationRoles = new UserOrganizationRoleRepository(executor);
    this.userPreferences = new UserPreferenceRepository(executor);
    this.users = new UserRepository(executor);
  }

  async replaceAllFromStore(store: InMemoryBackendStore): Promise<void> {
    await this.organizations.replaceFromStore(store);
    await this.users.replaceFromStore(store);
    await this.userPreferences.replaceFromStore(store);
    await this.roles.replaceFromStore(store);
    await this.permissions.replaceFromStore(store);
    await this.permissionExtensions.replaceFromStore(store);
    await this.routeMetadata.replaceFromStore(store);
    await this.menus.replaceFromStore(store);
    await this.userOrganizationRoles.replaceFromStore(store);
    await this.authSessions.replaceFromStore(store);
    await this.initializationState.replaceFromStore(store);
  }
}
