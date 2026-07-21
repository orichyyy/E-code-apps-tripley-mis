import type {
  CreateAnnouncementRequest,
  CreateWebhookSubscriptionRequest,
  ListAnnouncementsQuery,
  ListCurrentAnnouncementsQuery,
  UpdateAnnouncementRequest,
  UpdateWebhookSubscriptionRequest,
} from "@web-admin-base/contracts";
import {
  encryptWebhookSecret,
  validateWebhookUrl,
  type WebhookDeliveryConfig,
} from "@web-admin-base/adapters";
import { type ListWebhookDeliveriesQuery } from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import { CommunicationsRepository } from "./communications.repository";
import type { WebhookSubscriptionRecord } from "./communications.types";
import type { AnnouncementOperations } from "./announcement.types";
import {
  InMemoryAnnouncementRepository,
  type AnnouncementOrganizationSource,
} from "./in-memory-announcement.repository";
import {
  assertWebhookEventTypes,
  listWebhookEventCatalog,
  type WebhookEventCatalogSource,
} from "./webhook-event-catalog";

export class CommunicationsServices {
  private readonly memory = {
    webhooks: [] as Array<WebhookSubscriptionRecord & { secret: string | null }>,
  };
  private sequence = 1;
  private readonly announcements: AnnouncementOperations;

  constructor(
    private readonly repository?: CommunicationsRepository,
    private readonly webhookConfig?: WebhookDeliveryConfig,
    organizationSource?: AnnouncementOrganizationSource,
    private readonly webhookEventCatalogSource?: WebhookEventCatalogSource,
  ) {
    this.announcements =
      repository?.announcements ?? new InMemoryAnnouncementRepository(organizationSource);
  }

  static inMemory(
    organizationSource?: AnnouncementOrganizationSource,
    webhookEventCatalogSource?: WebhookEventCatalogSource,
  ): CommunicationsServices {
    return new CommunicationsServices(
      undefined,
      undefined,
      organizationSource,
      webhookEventCatalogSource,
    );
  }

  static database(
    repository = CommunicationsRepository.fromEnvironment(),
    webhookConfig?: WebhookDeliveryConfig,
    webhookEventCatalogSource?: WebhookEventCatalogSource,
  ): CommunicationsServices {
    return new CommunicationsServices(
      repository,
      webhookConfig,
      undefined,
      webhookEventCatalogSource,
    );
  }

  close(): Promise<void> {
    return this.repository?.close() ?? Promise.resolve();
  }

  listAnnouncements(query: ListAnnouncementsQuery) {
    return this.announcements.listCatalog(query);
  }

  listCurrentAnnouncements(query: ListCurrentAnnouncementsQuery, currentOrganizationId: string) {
    return this.announcements.listCurrent(query, currentOrganizationId);
  }

  createAnnouncement(input: CreateAnnouncementRequest, actorId: string | null) {
    return this.announcements.create(input, actorId);
  }

  updateAnnouncement(id: string, input: UpdateAnnouncementRequest, actorId: string | null) {
    return this.announcements.update(id, input, actorId);
  }

  setAnnouncementPublished(id: string, published: boolean, actorId: string | null) {
    return published
      ? this.announcements.publish(id, actorId)
      : this.announcements.unpublish(id, actorId);
  }

  deleteAnnouncement(id: string, actorId: string | null) {
    return this.announcements.delete(id, actorId);
  }

  listWebhooks() {
    const records = this.repository?.webhooks.list() ?? Promise.resolve(this.memory.webhooks);
    return records.then((items) => items.map(stripWebhookSecret));
  }

  async createWebhook(input: CreateWebhookSubscriptionRequest, actorId: string | null) {
    this.validateWebhookInput(input.url);
    await assertWebhookEventTypes(this.webhookEventCatalogSource, input.eventTypes);
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
    return stripWebhookSecret(record);
  }

  async updateWebhook(id: string, input: UpdateWebhookSubscriptionRequest, actorId: string | null) {
    if (input.url) this.validateWebhookInput(input.url);
    if (input.eventTypes) {
      await assertWebhookEventTypes(this.webhookEventCatalogSource, input.eventTypes);
    }
    const encryptedSecret = Object.hasOwn(input, "secret")
      ? this.encryptSecret(input.secret ?? null)
      : undefined;
    if (this.repository) {
      return this.repository.webhooks.update(id, input, encryptedSecret, actorId);
    }
    const record = this.memory.webhooks.find((item) => item.id === id && !item.isDeleted);
    if (!record) return null;
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
    return stripWebhookSecret(record);
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
    return listWebhookEventCatalog(this.webhookEventCatalogSource);
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
