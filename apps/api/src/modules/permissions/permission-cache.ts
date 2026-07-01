import type { CacheAdapter } from "@web-admin-base/adapters";

export type PermissionContext = {
  userId: string;
  organizationId: string;
  permissionCodes: string[];
};

export class PermissionCache {
  constructor(private readonly cache: CacheAdapter) {}

  async get(userId: string, organizationId: string): Promise<PermissionContext | null> {
    return this.cache.get<PermissionContext>(this.key(userId, organizationId));
  }

  async set(context: PermissionContext): Promise<void> {
    await this.cache.set(this.key(context.userId, context.organizationId), context, {
      ttlSeconds: 300
    });
  }

  async invalidate(userId: string, organizationId: string): Promise<void> {
    await this.cache.delete(this.key(userId, organizationId));
  }

  private key(userId: string, organizationId: string): string {
    return `permissions:${userId}:${organizationId}`;
  }
}
