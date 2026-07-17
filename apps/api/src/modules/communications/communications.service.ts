import type {
  CreateAnnouncementRequest,
  CreateWebhookSubscriptionRequest,
  UpdateAnnouncementRequest,
  UpdateWebhookSubscriptionRequest,
} from "@web-admin-base/contracts";
import {
  encryptWebhookSecret,
  validateWebhookUrl,
  type WebhookDeliveryConfig,
} from "@web-admin-base/adapters";
import { webhookEventCatalog, type ListWebhookDeliveriesQuery } from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import { CommunicationsRepository } from "./communications.repository";
import type { AnnouncementRecord, WebhookSubscriptionRecord } from "./communications.types";

export class CommunicationsServices {
  private readonly memory = {
    announcements: [] as AnnouncementRecord[],
    webhooks: [] as Array<WebhookSubscriptionRecord & { secret: string | null }>,
  };
  private sequence = 1;

  constructor(
    private readonly repository?: CommunicationsRepository,
    private readonly webhookConfig?: WebhookDeliveryConfig,
  ) {}

  static inMemory(): CommunicationsServices {
    return new CommunicationsServices();
  }

  static database(
    repository = CommunicationsRepository.fromEnvironment(),
    webhookConfig?: WebhookDeliveryConfig,
  ): CommunicationsServices {
    return new CommunicationsServices(repository, webhookConfig);
  }

  close(): Promise<void> {
    return this.repository?.close() ?? Promise.resolve();
  }

  listAnnouncements() {
    return this.repository?.listAnnouncements() ?? Promise.resolve(this.memory.announcements);
  }

  createAnnouncement(input: CreateAnnouncementRequest, actorId: string | null) {
    if (this.repository) return this.repository.createAnnouncement(input, actorId);
    const now = new Date().toISOString();
    const record: AnnouncementRecord = {
      id: this.nextId(),
      tenantId: null,
      title: input.title,
      content: input.content,
      scopeType: input.scopeType,
      status: "draft",
      publishedAt: null,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
      updatedBy: actorId,
    };
    this.memory.announcements.unshift(record);
    return Promise.resolve(record);
  }

  updateAnnouncement(id: string, input: UpdateAnnouncementRequest, actorId: string | null) {
    if (this.repository) return this.repository.updateAnnouncement(id, input, actorId);
    const record = this.memory.announcements.find((item) => item.id === id && !item.isDeleted);
    if (!record) return Promise.resolve(null);
    Object.assign(record, input, { updatedAt: new Date().toISOString(), updatedBy: actorId });
    return Promise.resolve(record);
  }

  setAnnouncementPublished(id: string, published: boolean, actorId: string | null) {
    if (this.repository) return this.repository.setAnnouncementPublished(id, published, actorId);
    const record = this.memory.announcements.find((item) => item.id === id && !item.isDeleted);
    if (!record) return Promise.resolve(null);
    const now = new Date().toISOString();
    record.status = published ? "published" : "draft";
    record.publishedAt = published ? now : null;
    record.updatedAt = now;
    record.updatedBy = actorId;
    return Promise.resolve(record);
  }

  listWebhooks() {
    const records = this.repository?.webhooks.list() ?? Promise.resolve(this.memory.webhooks);
    return records.then((items) => items.map(stripWebhookSecret));
  }

  createWebhook(input: CreateWebhookSubscriptionRequest, actorId: string | null) {
    this.validateWebhookInput(input.url);
    if (this.repository) {
      return this.repository.webhooks.create(
        input,
        this.encryptSecret(input.secret ?? null),
        actorId,
      );
    }
    const now = new Date().toISOString();
    const record: WebhookSubscriptionRecord & { secret: string | null } = {
      id: this.nextId(),
      tenantId: null,
      name: input.name,
      url: input.url,
      eventTypes: input.eventTypes,
      secret: input.secret ?? null,
      secretConfigured: Boolean(input.secret),
      revision: 1,
      status: input.status,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now,
      createdBy: actorId,
      updatedBy: actorId,
    };
    this.memory.webhooks.unshift(record);
    return Promise.resolve(stripWebhookSecret(record));
  }

  updateWebhook(id: string, input: UpdateWebhookSubscriptionRequest, actorId: string | null) {
    if (input.url) this.validateWebhookInput(input.url);
    const encryptedSecret = Object.hasOwn(input, "secret")
      ? this.encryptSecret(input.secret ?? null)
      : undefined;
    if (this.repository)
      return this.repository.webhooks.update(id, input, encryptedSecret, actorId);
    const record = this.memory.webhooks.find((item) => item.id === id && !item.isDeleted);
    if (!record) return Promise.resolve(null);
    const affectsDelivery =
      input.url !== undefined ||
      input.eventTypes !== undefined ||
      input.status !== undefined ||
      Object.hasOwn(input, "secret");
    Object.assign(record, input, {
      secret: Object.hasOwn(input, "secret") ? (input.secret ?? null) : record.secret,
      secretConfigured: Object.hasOwn(input, "secret")
        ? Boolean(input.secret)
        : record.secretConfigured,
      updatedAt: new Date().toISOString(),
      updatedBy: actorId,
      revision: record.revision + (affectsDelivery ? 1 : 0),
    });
    return Promise.resolve(stripWebhookSecret(record));
  }

  deleteWebhook(id: string, actorId: string | null) {
    if (this.repository) return this.repository.webhooks.delete(id, actorId);
    const record = this.memory.webhooks.find((item) => item.id === id && !item.isDeleted);
    if (!record) return Promise.resolve(null);
    const now = new Date().toISOString();
    Object.assign(record, {
      status: "disabled",
      revision: record.revision + 1,
      isDeleted: true,
      deletedAt: now,
      deletedBy: actorId,
      updatedAt: now,
      updatedBy: actorId,
    });
    return Promise.resolve(stripWebhookSecret(record));
  }

  listWebhookEventTypes() {
    return Promise.resolve(webhookEventCatalog);
  }

  listWebhookDeliveries(query: ListWebhookDeliveriesQuery) {
    return (
      this.repository?.webhooks.listDeliveries(query) ??
      Promise.resolve({ items: [], page: query.page, pageSize: query.pageSize, total: 0 })
    );
  }

  getWebhookDelivery(id: string) {
    return this.repository?.webhooks.getDelivery(id) ?? Promise.resolve(null);
  }

  private validateWebhookInput(url: string): void {
    try {
      validateWebhookUrl(url, {
        allowedHosts: this.webhookConfig?.allowedHosts,
        allowInsecureLocalhost: this.webhookConfig?.allowInsecureLocalhost,
      });
    } catch (error) {
      throw createKnownError("VALIDATION_INVALID_REQUEST", {
        field: "url",
        reason: error instanceof Error ? error.message : "Invalid webhook URL.",
      });
    }
  }

  private encryptSecret(secret: string | null): string | null {
    if (!secret) return null;
    const keyId = this.webhookConfig?.activeKeyId;
    if (!keyId || !this.webhookConfig) {
      throw createKnownError("VALIDATION_INVALID_REQUEST", {
        field: "secret",
        reason: "Webhook secret encryption is not configured.",
      });
    }
    return encryptWebhookSecret(secret, keyId, this.webhookConfig.secretKeys);
  }

  private nextId(): string {
    const id = String(this.sequence);
    this.sequence += 1;
    return id;
  }
}

function stripWebhookSecret<T extends WebhookSubscriptionRecord>(
  record: T,
): WebhookSubscriptionRecord {
  const safeRecord = { ...record } as WebhookSubscriptionRecord & { secret?: string | null };
  delete safeRecord.secret;
  return safeRecord;
}
