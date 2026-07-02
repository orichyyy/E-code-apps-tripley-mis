import type {
  CreateOrganizationRequest,
  UpdateOrganizationRequest
} from "@web-admin-base/contracts";
import {
  allocateNextOrgSegment,
  decodeOrgPath,
  encodeOrgPath,
  isDescendantPath
} from "@web-admin-base/db";

import { createKnownError } from "../../core/errors/error-codes";
import { nowUtc, toUtcIso } from "../../core/time/utc";
import type { OrganizationRecord, PublicOrganization } from "./domain";
import type { BackendCoreContext } from "./service-context";
import { requireOrganization } from "./store-guards";
import { toPublicOrganization } from "./serializers";

export class OrganizationService {
  constructor(private readonly context: BackendCoreContext) {}

  list(): PublicOrganization[] {
    return [...this.context.store.organizations.values()]
      .filter((organization) => !organization.isDeleted)
      .sort((a, b) => (a.path < b.path ? -1 : 1))
      .map(toPublicOrganization);
  }

  get(id: string): PublicOrganization {
    return toPublicOrganization(requireOrganization(this.context.store, id));
  }

  create(input: CreateOrganizationRequest): PublicOrganization {
    return toPublicOrganization(this.createRecord(input));
  }

  createRecord(input: CreateOrganizationRequest): OrganizationRecord {
    const store = this.context.store;
    this.ensureUniqueOrganizationCode(input.code);

    const parent = input.parentOrganizationId
      ? requireOrganization(store, input.parentOrganizationId)
      : undefined;
    if (parent?.status === "disabled") throw createKnownError("BUSINESS_ORG_DISABLED");

    const level = parent ? parent.level + 1 : 1;
    if (level > 8) throw createKnownError("BUSINESS_MAX_ORG_DEPTH_EXCEEDED");

    const segment = allocateNextOrgSegment(this.findUsedSiblingSegments(parent), level);
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
      sortOrder: input.sortOrder ?? 0,
      status: "enabled",
      remark: input.remark ?? null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now
    };
    store.organizations.set(organization.id, organization);
    return organization;
  }

  update(id: string, input: UpdateOrganizationRequest): PublicOrganization {
    const organization = requireOrganization(this.context.store, id);
    if (input.code !== undefined) this.ensureUniqueOrganizationCode(input.code, organization.id);
    if (input.name !== undefined) organization.name = input.name;
    if (input.code !== undefined) organization.code = input.code;
    if (input.sortOrder !== undefined) organization.sortOrder = input.sortOrder;
    if (input.remark !== undefined) organization.remark = input.remark;
    organization.updatedAt = toUtcIso(nowUtc());
    return toPublicOrganization(organization);
  }

  disable(id: string): PublicOrganization[] {
    const organization = requireOrganization(this.context.store, id);
    const now = toUtcIso(nowUtc());
    const affected = [...this.context.store.organizations.values()].filter(
      (candidate) =>
        candidate.id === id || isDescendantPath(candidate.path, organization.path, organization.level)
    );
    affected.forEach((candidate) => {
      candidate.status = "disabled";
      candidate.updatedAt = now;
    });
    return affected.map(toPublicOrganization);
  }

  enable(id: string): PublicOrganization {
    const organization = requireOrganization(this.context.store, id);
    organization.status = "enabled";
    organization.updatedAt = toUtcIso(nowUtc());
    return toPublicOrganization(organization);
  }

  delete(id: string, deletedBy: string | null = null): PublicOrganization {
    const organization = requireOrganization(this.context.store, id);
    const now = toUtcIso(nowUtc());
    organization.isDeleted = true;
    organization.deletedAt = now;
    organization.deletedBy = deletedBy;
    organization.updatedAt = now;
    return toPublicOrganization(organization);
  }

  private findUsedSiblingSegments(parent?: OrganizationRecord): number[] {
    return [...this.context.store.organizations.values()]
      .filter((organization) => {
        if (organization.isDeleted) return false;
        if (!parent) return organization.level === 1;
        return (
          organization.level === parent.level + 1 &&
          isDescendantPath(organization.path, parent.path, parent.level)
        );
      })
      .map((organization) => organization.segment);
  }

  private ensureUniqueOrganizationCode(code: string, currentOrganizationId?: string): void {
    const duplicate = [...this.context.store.organizations.values()].some(
      (organization) =>
        !organization.isDeleted &&
        organization.id !== currentOrganizationId &&
        organization.code === code
    );
    if (duplicate) throw createKnownError("VALIDATION_DUPLICATE_ORGANIZATION_CODE");
  }
}
