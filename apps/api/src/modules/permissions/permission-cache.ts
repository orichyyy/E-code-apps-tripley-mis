import type { CacheAdapter } from "@web-admin-base/adapters";
import type {
  DataPermissionRuleDocument,
  FieldPermissionScenario,
} from "@web-admin-base/contracts";

export type PermissionContext = {
  userId: string;
  organizationId: string;
  isSuperAdministrator: boolean;
  permissionCodes: string[];
  dataPermissions?: Array<{
    roleId: string;
    permissionCode: string;
    effect: "allow" | "deny";
    rule: DataPermissionRuleDocument;
  }>;
  fieldPermissions?: Array<{
    roleId: string;
    resource: string;
    field: string;
    scenario: FieldPermissionScenario;
    effect: "visible" | "hidden" | "readonly";
  }>;
  userPermissionOverrides?: Array<{
    permissionCode: string;
    effect: "allow" | "deny";
  }>;
};

export class PermissionCache {
  constructor(private readonly cache: CacheAdapter) {}

  async get(userId: string, organizationId: string): Promise<PermissionContext | null> {
    return this.cache.get<PermissionContext>(this.key(userId, organizationId));
  }

  async set(context: PermissionContext): Promise<void> {
    await this.cache.set(this.key(context.userId, context.organizationId), context, {
      ttlSeconds: 300,
    });
  }

  async invalidate(userId: string, organizationId: string): Promise<void> {
    await this.cache.delete(this.key(userId, organizationId));
  }

  private key(userId: string, organizationId: string): string {
    return `permissions:${userId}:${organizationId}`;
  }
}
