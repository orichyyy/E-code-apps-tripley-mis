import type {
  CreateAnnouncementRequest,
  CreateWebhookSubscriptionRequest,
  UpdateAnnouncementRequest,
  UpdateWebhookSubscriptionRequest,
} from "@web-admin-base/contracts";

import { CommunicationsRepository } from "./communications.repository";
import type { AnnouncementRecord, WebhookSubscriptionRecord } from "./communications.types";

export class CommunicationsServices {
  private readonly memory = {
    announcements: [] as AnnouncementRecord[],
    webhooks: [] as Array<WebhookSubscriptionRecord & { secret: string | null }>,
  };
  private sequence = 1;

  constructor(private readonly repository?: CommunicationsRepository) {}

  static inMemory(): CommunicationsServices {
    return new CommunicationsServices();
  }

  static database(repository = CommunicationsRepository.fromEnvironment()): CommunicationsServices {
    return new CommunicationsServices(repository);
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
    const records = this.repository?.listWebhooks() ?? Promise.resolve(this.memory.webhooks);
    return records.then((items) => items.map(stripWebhookSecret));
  }

  createWebhook(input: CreateWebhookSubscriptionRequest, actorId: string | null) {
    if (this.repository) return this.repository.createWebhook(input, actorId);
    const now = new Date().toISOString();
    const record: WebhookSubscriptionRecord & { secret: string | null } = {
      id: this.nextId(),
      tenantId: null,
      name: input.name,
      url: input.url,
      eventTypes: input.eventTypes,
      secret: input.secret ?? null,
      secretConfigured: Boolean(input.secret),
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
    if (this.repository) return this.repository.updateWebhook(id, input, actorId);
    const record = this.memory.webhooks.find((item) => item.id === id && !item.isDeleted);
    if (!record) return Promise.resolve(null);
    Object.assign(record, input, {
      secret: Object.hasOwn(input, "secret") ? (input.secret ?? null) : record.secret,
      secretConfigured: Object.hasOwn(input, "secret")
        ? Boolean(input.secret)
        : record.secretConfigured,
      updatedAt: new Date().toISOString(),
      updatedBy: actorId,
    });
    return Promise.resolve(stripWebhookSecret(record));
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
