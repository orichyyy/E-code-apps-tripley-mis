import type {
  CreateOrganizationRequest,
  UpdateOrganizationDepthConfigRequest,
  UpdateOrganizationRequest
} from "@web-admin-base/contracts";
import {
  allocateNextOrgSegment,
  decodeOrgPath,
  encodeOrgPath,
  isDescendantPath,
  OrgSegmentRangeExhaustedError
} from "@web-admin-base/db";

import { createKnownError } from "../../core/errors/error-codes";
import { nowUtc, toUtcIso } from "../../core/time/utc";
import type {
  OrganizationRecord,
  PublicOrganization,
  PublicOrganizationTreeNode
} from "./domain";
import type { BackendCoreContext } from "./service-context";
import { requireOrganization, requireUser } from "./store-guards";
import { toPublicOrganization } from "./serializers";

export class OrganizationService {
  constructor(private readonly context: BackendCoreContext) {}

  getDepthConfig() {
    return {
      maxDepth: this.context.config.maxOrganizationDepth,
      maxSupportedDepth: 8
    };
  }

  updateDepthConfig(input: UpdateOrganizationDepthConfigRequest) {
    this.context.config.maxOrganizationDepth = input.maxDepth;
    return this.getDepthConfig();
  }

  list(): PublicOrganization[] {
    return [...this.context.store.organizations.values()]
      .filter((organization) => !organization.isDeleted)
      .sort((a, b) => (a.path < b.path ? -1 : 1))
      .map(toPublicOrganization);
  }

  listTree(): PublicOrganizationTreeNode[] {
    const organizations = [...this.context.store.organizations.values()]
      .filter((organization) => !organization.isDeleted)
      .sort(compareOrganizationsForTree);
    const nodesByPath = new Map<string, PublicOrganizationTreeNode>();
    const roots: PublicOrganizationTreeNode[] = [];

    for (const organization of organizations) {
      const node = {
        ...toPublicOrganization(organization),
        children: []
      };
      nodesByPath.set(organization.path.toString(), node);

      const parentPath = this.getParentPath(organization);
      const parent = parentPath ? nodesByPath.get(parentPath.toString()) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return sortOrganizationTree(roots);
  }

  get(id: string): PublicOrganization {
    return toPublicOrganization(requireOrganization(this.context.store, id));
  }

  create(
    input: CreateOrganizationRequest,
    actorId: string | null = null
  ): PublicOrganization {
    return toPublicOrganization(this.createRecord(input, actorId));
  }

  createRecord(
    input: CreateOrganizationRequest,
    actorId: string | null = null
  ): OrganizationRecord {
    const store = this.context.store;
    this.ensureUniqueOrganizationCode(input.code);

    const parent = input.parentOrganizationId
      ? requireOrganization(store, input.parentOrganizationId)
      : undefined;
    if (parent?.status === "disabled") throw createKnownError("BUSINESS_ORG_DISABLED");
    if (input.managerUserId !== undefined) requireUser(store, input.managerUserId);

    const level = parent ? parent.level + 1 : 1;
    if (level > this.context.config.maxOrganizationDepth || level > 8) {
      throw createKnownError("BUSINESS_MAX_ORG_DEPTH_EXCEEDED");
    }

    const segment = this.allocateSegment(parent, level);
    const path = encodeOrgPath([...(parent ? decodeOrgPath(parent.path) : []), segment]);
    const now = toUtcIso(nowUtc());
    const organization: OrganizationRecord = {
      id: store.nextId("organization"),
      tenantId: null,
      path,
      level,
      segment,
      name: input.name,
      code: input.code,
      managerUserId: input.managerUserId ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      sortOrder: input.sortOrder ?? 0,
      status: "enabled",
      remark: input.remark ?? null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
      updatedBy: actorId
    };
    store.organizations.set(organization.id, organization);
    return organization;
  }

  update(
    id: string,
    input: UpdateOrganizationRequest,
    actorId: string | null = null
  ): PublicOrganization {
    const organization = requireOrganization(this.context.store, id);
    if (input.code !== undefined) this.ensureUniqueOrganizationCode(input.code, organization.id);
    if (input.managerUserId !== undefined && input.managerUserId !== null) {
      requireUser(this.context.store, input.managerUserId);
    }
    if (input.name !== undefined) organization.name = input.name;
    if (input.code !== undefined) organization.code = input.code;
    if (input.managerUserId !== undefined) organization.managerUserId = input.managerUserId;
    if (input.phone !== undefined) organization.phone = input.phone;
    if (input.email !== undefined) organization.email = input.email;
    if (input.address !== undefined) organization.address = input.address;
    if (input.sortOrder !== undefined) organization.sortOrder = input.sortOrder;
    if (input.remark !== undefined) organization.remark = input.remark;
    organization.updatedAt = toUtcIso(nowUtc());
    organization.updatedBy = actorId;
    return toPublicOrganization(organization);
  }

  disable(id: string, actorId: string | null = null): PublicOrganization[] {
    const organization = requireOrganization(this.context.store, id);
    const now = toUtcIso(nowUtc());
    const affected = [...this.context.store.organizations.values()].filter(
      (candidate) =>
        !candidate.isDeleted &&
        (candidate.id === id ||
          isDescendantPath(candidate.path, organization.path, organization.level))
    );
    affected.forEach((candidate) => {
      candidate.status = "disabled";
      candidate.updatedAt = now;
      candidate.updatedBy = actorId;
    });
    return affected.map(toPublicOrganization);
  }

  enable(id: string, actorId: string | null = null): PublicOrganization {
    const organization = requireOrganization(this.context.store, id);
    if (this.hasDisabledAncestor(organization)) {
      throw createKnownError("BUSINESS_ORG_DISABLED");
    }
    organization.status = "enabled";
    organization.updatedAt = toUtcIso(nowUtc());
    organization.updatedBy = actorId;
    return toPublicOrganization(organization);
  }

  delete(id: string, deletedBy: string | null = null): PublicOrganization {
    const organization = requireOrganization(this.context.store, id);
    const now = toUtcIso(nowUtc());
    const affectedOrganizations = [organization, ...this.findDescendantOrganizations(organization)];
    for (const affectedOrganization of affectedOrganizations) {
      affectedOrganization.isDeleted = true;
      affectedOrganization.deletedAt = now;
      affectedOrganization.deletedBy = deletedBy;
      affectedOrganization.updatedAt = now;
      affectedOrganization.updatedBy = deletedBy;
    }
    this.softDeleteOrganizationRoleBindings(
      new Set(affectedOrganizations.map((affectedOrganization) => affectedOrganization.id)),
      now,
      deletedBy
    );
    return toPublicOrganization(organization);
  }

  private findUsedSiblingSegments(parent?: OrganizationRecord): number[] {
    return [...this.context.store.organizations.values()]
      .filter((organization) => {
        if (!parent) return organization.level === 1;
        return (
          organization.level === parent.level + 1 &&
          isDescendantPath(organization.path, parent.path, parent.level)
        );
      })
      .map((organization) => organization.segment);
  }

  private findDescendantOrganizations(organization: OrganizationRecord): OrganizationRecord[] {
    return [...this.context.store.organizations.values()].filter(
      (candidate) =>
        !candidate.isDeleted &&
        candidate.id !== organization.id &&
        isDescendantPath(candidate.path, organization.path, organization.level)
    );
  }

  private softDeleteOrganizationRoleBindings(
    organizationIds: Set<string>,
    deletedAt: string,
    deletedBy: string | null
  ): void {
    for (const binding of this.context.store.userOrganizationRoles.values()) {
      if (binding.isDeleted || !organizationIds.has(binding.organizationId)) continue;
      binding.isDeleted = true;
      binding.isPrimary = false;
      binding.status = "disabled";
      binding.deletedAt = deletedAt;
      binding.deletedBy = deletedBy;
      binding.updatedAt = deletedAt;
      binding.updatedBy = deletedBy;
    }
  }

  private allocateSegment(parent: OrganizationRecord | undefined, level: number): number {
    try {
      return allocateNextOrgSegment(this.findUsedSiblingSegments(parent), level);
    } catch (error) {
      if (error instanceof OrgSegmentRangeExhaustedError) {
        throw createKnownError("BUSINESS_ORG_SEGMENT_RANGE_EXHAUSTED");
      }
      throw error;
    }
  }

  private hasDisabledAncestor(organization: OrganizationRecord): boolean {
    return [...this.context.store.organizations.values()].some(
      (candidate) =>
        !candidate.isDeleted &&
        candidate.status === "disabled" &&
        isDescendantPath(organization.path, candidate.path, candidate.level)
    );
  }

  private ensureUniqueOrganizationCode(code: string, currentOrganizationId?: string): void {
    const duplicate = [...this.context.store.organizations.values()].some(
      (organization) =>
        organization.id !== currentOrganizationId &&
        organization.code === code
    );
    if (duplicate) throw createKnownError("VALIDATION_DUPLICATE_ORGANIZATION_CODE");
  }

  private getParentPath(organization: OrganizationRecord): bigint | null {
    if (organization.level <= 1) return null;
    return encodeOrgPath(decodeOrgPath(organization.path).slice(0, -1));
  }
}

function compareOrganizationsForTree(left: OrganizationRecord, right: OrganizationRecord): number {
  if (left.level !== right.level) return left.level - right.level;
  if (left.path < right.path) return -1;
  if (left.path > right.path) return 1;
  return left.id.localeCompare(right.id);
}

function sortOrganizationTree(
  nodes: PublicOrganizationTreeNode[]
): PublicOrganizationTreeNode[] {
  nodes.sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.segment - right.segment ||
      left.id.localeCompare(right.id)
  );
  nodes.forEach((node) => sortOrganizationTree(node.children));
  return nodes;
}
