import type { QueueAdapter } from "@web-admin-base/adapters";
import {
  inAppNotificationDispatchJobType,
  inAppNotificationDispatchPayloadSchema,
  type InAppNotificationDispatchPayload,
} from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import { renderNotificationTemplate } from "./notification-template-renderer";
import type { NotificationTemplateRecord } from "./email-notification-sender";

export type InAppNotificationAudience =
  { type: "users"; userIds: string[] } | { type: "organization"; organizationId: string };

export type EnqueueInAppNotificationInput = {
  templateCode: string;
  locale: string;
  audience: InAppNotificationAudience;
  variables?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

export type InAppNotificationRecordInput = {
  userId: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  createdBy: string | null;
};

export async function enqueueInAppNotificationDispatch(
  input: EnqueueInAppNotificationInput,
  dependencies: {
    listTemplates: () => Promise<unknown[]>;
    resolveOrganizationUserIds: (organizationId: string) => Promise<string[]>;
    queue: QueueAdapter;
  },
) {
  const variables = input.variables ?? {};
  const template = findEnabledInAppTemplate(
    await dependencies.listTemplates(),
    input.templateCode,
    input.locale,
  );
  const recipientUserIds = uniqueIds(
    input.audience.type === "users"
      ? input.audience.userIds
      : await dependencies.resolveOrganizationUserIds(input.audience.organizationId),
  );
  if (recipientUserIds.length === 0) {
    throw createKnownError("VALIDATION_INVALID_REQUEST", { field: "recipientUserIds" });
  }

  const payload = inAppNotificationDispatchPayloadSchema.parse({
    recipientUserIds,
    title: renderNotificationTemplate(template.subject, variables),
    body: renderNotificationTemplate(template.body, variables),
    metadata: {
      ...(input.metadata ?? {}),
      templateCode: input.templateCode,
      locale: input.locale,
      audience: input.audience,
    },
    createdBy: input.createdBy ?? null,
    enqueuedAt: new Date().toISOString(),
  });
  const job = await dependencies.queue.enqueue(inAppNotificationDispatchJobType, payload);

  return {
    jobId: job.id,
    jobType: job.type,
    recipientCount: recipientUserIds.length,
  };
}

export async function dispatchInAppNotificationJob(
  payload: InAppNotificationDispatchPayload,
  dependencies: {
    createNotifications: (records: InAppNotificationRecordInput[]) => Promise<void>;
  },
) {
  const parsed = inAppNotificationDispatchPayloadSchema.parse(payload);
  await dependencies.createNotifications(
    parsed.recipientUserIds.map((userId) => ({
      userId,
      title: parsed.title,
      body: parsed.body,
      metadata: parsed.metadata,
      createdBy: parsed.createdBy,
    })),
  );
  return { createdCount: parsed.recipientUserIds.length };
}

function findEnabledInAppTemplate(
  templates: unknown[],
  code: string,
  locale: string,
): NotificationTemplateRecord & { subject: string } {
  const template = (templates as NotificationTemplateRecord[]).find(
    (item) =>
      item.code === code &&
      item.locale === locale &&
      item.channel === "in_app" &&
      (item.status ?? "enabled") === "enabled",
  );
  if (!template) {
    throw createKnownError("VALIDATION_INVALID_REQUEST", {
      templateCode: code,
      locale,
      channel: "in_app",
    });
  }
  if (!template.subject || template.subject.trim().length === 0) {
    throw createKnownError("VALIDATION_INVALID_REQUEST", {
      templateCode: code,
      field: "subject",
    });
  }
  return { ...template, subject: template.subject };
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}
