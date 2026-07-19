import { isDescendantPath } from "@web-admin-base/db";

import { createKnownError } from "../../core/errors/error-codes";
import type {
  AnnouncementOrganization,
  AnnouncementRecord,
  AnnouncementScopeType,
} from "./announcement.types";

export function validateAnnouncementTargets(
  scopeType: AnnouncementScopeType,
  targetOrganizationIds: string[],
  organizations: AnnouncementOrganization[],
): void {
  if (scopeType === "system") {
    if (targetOrganizationIds.length > 0) invalidTargets("System scope cannot have targets.");
    return;
  }
  if (targetOrganizationIds.length === 0) {
    invalidTargets("Organization scope requires at least one target.");
  }
  if (new Set(targetOrganizationIds).size !== targetOrganizationIds.length) {
    invalidTargets("Duplicate targets are not allowed.");
  }

  const byId = new Map(organizations.map((organization) => [organization.id, organization]));
  const targets = targetOrganizationIds.map((id) => {
    const organization = byId.get(id);
    if (!organization || organization.isDeleted) {
      invalidTargets(`Organization target ${id} is unavailable.`);
    }
    if (organization.status !== "enabled") {
      invalidTargets(`Organization target ${id} is disabled.`);
    }
    return organization;
  });

  for (let left = 0; left < targets.length; left += 1) {
    for (let right = left + 1; right < targets.length; right += 1) {
      const first = targets[left];
      const second = targets[right];
      if (!first || !second) continue;
      if (covers(first, second) || covers(second, first)) {
        invalidTargets("Ancestor and descendant targets cannot be selected together.");
      }
    }
  }
}

export function resolveAnnouncementUpdate(
  current: AnnouncementRecord,
  input: {
    title?: string;
    content?: string;
    scopeType?: AnnouncementScopeType;
    targetOrganizationIds?: string[];
    expiresAt?: string | null;
  },
): Pick<
  AnnouncementRecord,
  "title" | "content" | "scopeType" | "targetOrganizationIds" | "expiresAt"
> {
  const scopeType = input.scopeType ?? current.scopeType;
  const targetOrganizationIds =
    scopeType === "system" ? [] : (input.targetOrganizationIds ?? current.targetOrganizationIds);
  return {
    title: input.title ?? current.title,
    content: input.content ?? current.content,
    scopeType,
    targetOrganizationIds,
    expiresAt: input.expiresAt === undefined ? current.expiresAt : input.expiresAt,
  };
}

export function requireDraft(record: AnnouncementRecord): void {
  if (record.status !== "draft") throw createKnownError("BUSINESS_ANNOUNCEMENT_NOT_DRAFT");
}

export function requirePublished(record: AnnouncementRecord): void {
  if (record.status !== "published") {
    throw createKnownError("BUSINESS_ANNOUNCEMENT_NOT_PUBLISHED");
  }
}

export function validatePublishExpiration(expiresAt: string | null, now: string): void {
  if (expiresAt && Date.parse(expiresAt) <= Date.parse(now)) {
    throw createKnownError("VALIDATION_ANNOUNCEMENT_EXPIRATION");
  }
}

export function organizationCovers(
  target: AnnouncementOrganization,
  candidate: AnnouncementOrganization,
): boolean {
  return target.id === candidate.id || covers(target, candidate);
}

function covers(ancestor: AnnouncementOrganization, candidate: AnnouncementOrganization): boolean {
  return isDescendantPath(BigInt(candidate.path), BigInt(ancestor.path), ancestor.level);
}

function invalidTargets(reason: string): never {
  throw createKnownError("VALIDATION_ANNOUNCEMENT_TARGETS", { reason });
}
