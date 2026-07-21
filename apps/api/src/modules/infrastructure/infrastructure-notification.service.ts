import type { NotificationChannelAdapter, QueueAdapter } from "@web-admin-base/adapters";
import type {
  CreateNotificationTemplateRequest,
  InAppNotificationDispatchPayload,
  SendTestEmailNotificationRequest,
  UpdateNotificationTemplateRequest,
} from "@web-admin-base/contracts";

import {
  sendTestEmailNotification,
  type NotificationTemplateRecord,
} from "./email-notification-sender";
import {
  dispatchInAppNotificationJob,
  enqueueInAppNotificationDispatch,
  type EnqueueInAppNotificationInput,
  type InAppNotificationRecordInput,
} from "./in-app-notification-dispatcher";
import type { InfrastructureRepository } from "./infrastructure.repository";
import { assertNotificationTemplateContract } from "./email-delivery-domain";
import { createKnownError } from "../../core/errors/error-codes";

export type NotificationMemory = {
  notifications: Array<
    Record<string, unknown> & { id: string; status: string; userId?: string | null }
  >;
  templates: NotificationTemplateRecord[];
};

export class InfrastructureNotificationService {
  constructor(
    private readonly dependencies: {
      repository?: InfrastructureRepository;
      memory: NotificationMemory;
      notificationChannel: NotificationChannelAdapter;
      queue: QueueAdapter;
      nextId: () => string;
      organizationUserResolver?: (organizationId: string) => Promise<string[]>;
      smtpEnabled: boolean;
    },
  ) {}

  listNotifications(userId: string) {
    return (
      this.dependencies.repository?.listNotifications(userId) ??
      Promise.resolve(
        this.dependencies.memory.notifications.filter(
          (notification) => notification.userId === userId,
        ),
      )
    );
  }

  updateNotificationStatus(
    id: string,
    status: "read" | "archived" | "deleted",
    actorId: string | null,
  ) {
    if (this.dependencies.repository) {
      return this.dependencies.repository.updateNotificationStatus(id, status, actorId);
    }
    const notification = this.dependencies.memory.notifications.find((item) => item.id === id);
    if (notification) notification.status = status;
    return Promise.resolve(notification ?? { id, status });
  }

  listNotificationTemplates() {
    return (
      this.dependencies.repository?.listNotificationTemplates() ??
      Promise.resolve(this.dependencies.memory.templates)
    );
  }

  createNotificationTemplate(input: CreateNotificationTemplateRequest) {
    this.assertTemplateContract(input);
    if (this.dependencies.repository)
      return this.dependencies.repository.createNotificationTemplate(input);
    const now = new Date().toISOString();
    const template = {
      id: this.dependencies.nextId(),
      ...input,
      subject: input.subject ?? null,
      status: "enabled",
      createdAt: now,
      updatedAt: now,
    };
    this.dependencies.memory.templates.unshift(template);
    return Promise.resolve(template);
  }

  async updateNotificationTemplate(id: string, input: UpdateNotificationTemplateRequest) {
    const templates = this.dependencies.repository
      ? await this.dependencies.repository.listNotificationTemplates()
      : this.dependencies.memory.templates;
    const existing = templates.find((item) => item.id === id);
    if (existing) this.assertTemplateContract({ ...existing, ...input });
    if (this.dependencies.repository)
      return this.dependencies.repository.updateNotificationTemplate(id, input);
    const template = this.dependencies.memory.templates.find((item) => item.id === id);
    if (!template) return Promise.resolve(null);
    Object.assign(template, input, { updatedAt: new Date().toISOString() });
    return Promise.resolve(template);
  }

  sendTestEmail(input: SendTestEmailNotificationRequest) {
    if (!this.dependencies.smtpEnabled) {
      throw createKnownError("BUSINESS_EMAIL_DELIVERY_DISABLED", { transport: "smtp" });
    }
    return sendTestEmailNotification(input, {
      listTemplates: () => this.listNotificationTemplates(),
      notificationChannel: this.dependencies.notificationChannel,
    });
  }

  private assertTemplateContract(input: {
    subject?: string | null;
    body: string;
    variables: string[];
  }): void {
    try {
      assertNotificationTemplateContract(input);
    } catch (error) {
      throw createKnownError("VALIDATION_TEMPLATE_VARIABLE_MISMATCH", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  enqueueInAppNotification(input: EnqueueInAppNotificationInput) {
    return enqueueInAppNotificationDispatch(input, {
      listTemplates: () => this.listNotificationTemplates(),
      resolveOrganizationUserIds: (organizationId) =>
        this.resolveOrganizationUserIds(organizationId),
      queue: this.dependencies.queue,
    });
  }

  dispatchInAppNotificationJob(payload: InAppNotificationDispatchPayload) {
    return dispatchInAppNotificationJob(payload, {
      createNotifications: (records) => this.createInAppNotifications(records),
    });
  }

  private async resolveOrganizationUserIds(organizationId: string): Promise<string[]> {
    if (this.dependencies.organizationUserResolver) {
      return this.dependencies.organizationUserResolver(organizationId);
    }
    return this.dependencies.repository?.listEnabledUserIdsForOrganization(organizationId) ?? [];
  }

  private async createInAppNotifications(records: InAppNotificationRecordInput[]): Promise<void> {
    if (this.dependencies.repository) {
      await this.dependencies.repository.createInAppNotifications(records);
      return;
    }
    const now = new Date().toISOString();
    for (const record of records) {
      const duplicate =
        record.requestKey !== null &&
        this.dependencies.memory.notifications.some(
          (item) => item.userId === record.userId && item.requestKey === record.requestKey,
        );
      if (duplicate) continue;
      this.dependencies.memory.notifications.unshift({
        id: this.dependencies.nextId(),
        userId: record.userId,
        requestKey: record.requestKey,
        channel: "in_app",
        title: record.title,
        body: record.body,
        status: "unread",
        metadata: { ...record.metadata, createdBy: record.createdBy },
        readAt: null,
        archivedAt: null,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}
