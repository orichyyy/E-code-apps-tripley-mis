import {
  computeNextCronRun,
  createDatabaseQueueAdapter,
  type FileStorageAdapter,
  type NotificationChannelAdapter,
  type QueueAdapter,
  type EmailDeliveryConfig,
} from "@web-admin-base/adapters";
import type { InAppNotificationDispatchPayload } from "@web-admin-base/contracts";
import type {
  CreateExportTaskRequest,
  CreateLogExportTaskRequest,
  CreateNotificationTemplateRequest,
  CreateScheduledTaskRequest,
  SendTestEmailNotificationRequest,
  UpdateNotificationTemplateRequest,
  UpdateScheduledTaskRequest,
} from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import type { NotificationTemplateRecord } from "./email-notification-sender";
import type { EmailDeliveryListQuery, EmailNotificationRequest } from "@web-admin-base/contracts";
import { EmailDeliveryRepository } from "./email-delivery.repository";
import { EmailDeliveryService } from "./email-delivery.service";
import type { FileUploadInput } from "./file-management";
import { createInMemoryExportTask } from "./in-memory-export-task";
import type { EnqueueInAppNotificationInput } from "./in-app-notification-dispatcher";
import { InfrastructureFileService } from "./infrastructure-file.service";
import { InfrastructureNotificationService } from "./infrastructure-notification.service";
import { InfrastructureRepository } from "./infrastructure.repository";
import {
  createDefaultFileStorage,
  createDefaultNotificationChannel,
  createDefaultQueue,
  readMaxFileSizeBytes,
  readPresignedUrlTtlSeconds,
  resolveInfrastructureServiceOptions,
  type InfrastructureServiceOptions,
} from "./infrastructure-service-options";
import type { LogType, ScheduledTaskInput } from "./infrastructure.types";

export class InfrastructureServices {
  private readonly memory = {
    importExportTasks: [] as Array<
      Record<string, unknown> & { id: string; resourceType: string; taskType: string }
    >,
    logs: [] as Array<Record<string, unknown> & { id: string; logType: LogType }>,
    notifications: [] as Array<
      Record<string, unknown> & { id: string; status: string; userId?: string | null }
    >,
    scheduledTasks: [] as Array<
      Record<string, unknown> & { id: string; code: string; enabled: boolean }
    >,
    templates: [] as NotificationTemplateRecord[],
  };
  private sequence = 1;
  private readonly notificationService: InfrastructureNotificationService;
  private readonly fileService: InfrastructureFileService;
  private readonly emailDeliveryService?: EmailDeliveryService;

  constructor(
    private readonly repository?: InfrastructureRepository,
    storage: FileStorageAdapter = createDefaultFileStorage(),
    maxFileSizeBytes = readMaxFileSizeBytes(),
    presignedUrlTtlSeconds = readPresignedUrlTtlSeconds(),
    notificationChannel: NotificationChannelAdapter = createDefaultNotificationChannel(),
    queue: QueueAdapter = createDefaultQueue(),
    organizationUserResolver?: (organizationId: string) => Promise<string[]>,
    emailDeliveryConfig?: EmailDeliveryConfig,
    smtpEnabled = true,
  ) {
    this.fileService = new InfrastructureFileService({
      repository,
      storage,
      maxFileSizeBytes,
      presignedUrlTtlSeconds,
      nextId: () => this.nextId(),
    });
    this.notificationService = new InfrastructureNotificationService({
      repository,
      memory: {
        notifications: this.memory.notifications,
        templates: this.memory.templates,
      },
      notificationChannel,
      queue,
      nextId: () => this.nextId(),
      organizationUserResolver,
      smtpEnabled,
    });
    if (repository && emailDeliveryConfig) {
      this.emailDeliveryService = new EmailDeliveryService(
        new EmailDeliveryRepository(repository.executor),
        emailDeliveryConfig,
      );
    }
  }

  static inMemory(
    options?: FileStorageAdapter | InfrastructureServiceOptions,
  ): InfrastructureServices {
    const resolved = resolveInfrastructureServiceOptions(options);
    return new InfrastructureServices(
      undefined,
      resolved.storage,
      resolved.maxFileSizeBytes,
      resolved.presignedUrlTtlSeconds,
      resolved.notificationChannel,
      resolved.queue,
      resolved.organizationUserResolver,
      resolved.emailDeliveryConfig,
      resolved.smtpEnabled ?? true,
    );
  }

  static database(
    repository = InfrastructureRepository.fromEnvironment(),
    options?: FileStorageAdapter | InfrastructureServiceOptions,
  ): InfrastructureServices {
    const resolved = resolveInfrastructureServiceOptions(options);
    const queue = resolved.queue ?? createDatabaseQueueAdapter(repository.executor);
    return new InfrastructureServices(
      repository,
      resolved.storage,
      resolved.maxFileSizeBytes,
      resolved.presignedUrlTtlSeconds,
      resolved.notificationChannel,
      queue,
      resolved.organizationUserResolver,
      resolved.emailDeliveryConfig,
      resolved.smtpEnabled ?? true,
    );
  }

  close(): Promise<void> {
    return this.repository?.close() ?? Promise.resolve();
  }

  listLogs(logType: LogType) {
    return (
      this.repository?.listLogs(logType) ??
      Promise.resolve(this.memory.logs.filter((log) => log.logType === logType))
    );
  }

  createLogExportTask(input: CreateLogExportTaskRequest, actorId: string | null) {
    return (
      this.repository?.createLogExportTask(input.logType, actorId) ??
      this.createMemoryExportTask(`logs:${input.logType}`, actorId)
    );
  }

  listFiles() {
    return this.fileService.listFiles();
  }

  getFile(id: string) {
    return this.fileService.getFile(id);
  }

  uploadFile(input: FileUploadInput) {
    return this.fileService.uploadFile(input);
  }

  getFileContent(id: string, mode: "download" | "preview") {
    return this.fileService.getFileContent(id, mode);
  }

  deleteFile(id: string, actorId: string | null) {
    return this.fileService.deleteFile(id, actorId);
  }

  listFileReferences(id: string) {
    return this.fileService.listFileReferences(id);
  }

  listNotifications(userId: string) {
    return this.notificationService.listNotifications(userId);
  }

  updateNotificationStatus(
    id: string,
    status: "read" | "archived" | "deleted",
    actorId: string | null,
  ) {
    return this.notificationService.updateNotificationStatus(id, status, actorId);
  }

  enqueueInAppNotification(input: EnqueueInAppNotificationInput) {
    return this.notificationService.enqueueInAppNotification(input);
  }

  dispatchInAppNotificationJob(payload: InAppNotificationDispatchPayload) {
    return this.notificationService.dispatchInAppNotificationJob(payload);
  }

  listNotificationTemplates() {
    return this.notificationService.listNotificationTemplates();
  }

  createNotificationTemplate(input: CreateNotificationTemplateRequest) {
    return this.notificationService.createNotificationTemplate(input);
  }

  updateNotificationTemplate(id: string, input: UpdateNotificationTemplateRequest) {
    return this.notificationService.updateNotificationTemplate(id, input);
  }

  async sendTestEmail(input: SendTestEmailNotificationRequest) {
    return this.notificationService.sendTestEmail(input);
  }

  requestEmailDelivery(input: EmailNotificationRequest) {
    if (!this.emailDeliveryService) throw createKnownError("BUSINESS_EMAIL_DELIVERY_DISABLED");
    return this.emailDeliveryService.request(input);
  }

  listEmailDeliveries(query: EmailDeliveryListQuery) {
    return (
      this.emailDeliveryService?.list(query) ??
      Promise.resolve({ items: [], total: 0, page: query.page, pageSize: query.pageSize })
    );
  }

  getEmailDelivery(id: string) {
    return this.emailDeliveryService?.get(id) ?? Promise.resolve(null);
  }

  listScheduledTasks() {
    return this.repository?.listScheduledTasks() ?? Promise.resolve(this.memory.scheduledTasks);
  }

  createScheduledTask(input: CreateScheduledTaskRequest) {
    const normalized: ScheduledTaskInput = {
      code: input.code,
      cronExpression: input.cronExpression,
      handlerType: input.handlerType,
      payload: input.payload,
      enabled: input.enabled,
    };
    if (this.repository) return this.repository.createScheduledTask(normalized);
    const now = new Date().toISOString();
    const task = {
      id: this.nextId(),
      ...normalized,
      status: normalized.enabled ? "enabled" : "disabled",
      nextRunAt: normalized.enabled
        ? nextScheduledRunOrThrow(normalized.cronExpression, now)
        : null,
      createdAt: now,
      updatedAt: now,
    };
    this.memory.scheduledTasks.unshift(task);
    return Promise.resolve(task);
  }

  updateScheduledTask(id: string, input: UpdateScheduledTaskRequest) {
    if (this.repository) return this.repository.updateScheduledTask(id, input);
    const task = this.memory.scheduledTasks.find((item) => item.id === id);
    if (!task) return Promise.resolve(null);
    const now = new Date().toISOString();
    const next = { ...task, ...input };
    Object.assign(task, input, {
      nextRunAt: next.enabled ? nextScheduledRunOrThrow(String(next.cronExpression), now) : null,
      updatedAt: now,
    });
    return Promise.resolve(task);
  }

  setScheduledTaskStatus(id: string, enabled: boolean) {
    if (this.repository) return this.repository.setScheduledTaskStatus(id, enabled);
    const task = this.memory.scheduledTasks.find((item) => item.id === id);
    if (!task) return Promise.resolve(null);
    const now = new Date().toISOString();
    task.enabled = enabled;
    task.status = enabled ? "enabled" : "disabled";
    task.nextRunAt = enabled ? nextScheduledRunOrThrow(String(task.cronExpression), now) : null;
    return Promise.resolve(task);
  }

  enqueueScheduledTaskRun(id: string) {
    return (
      this.repository?.enqueueScheduledTaskRun(id) ??
      Promise.resolve(this.memory.scheduledTasks.find((item) => item.id === id) ?? null)
    );
  }

  listImportExportTasks() {
    return (
      this.repository?.listImportExportTasks() ?? Promise.resolve(this.memory.importExportTasks)
    );
  }

  getImportExportTask(id: string) {
    return (
      this.repository?.getImportExportTask(id) ??
      Promise.resolve(this.memory.importExportTasks.find((task) => task.id === id) ?? null)
    );
  }

  createExportTask(input: CreateExportTaskRequest, actorId: string | null) {
    return (
      this.repository?.createExportTask(input.resourceType, actorId) ??
      this.createMemoryExportTask(input.resourceType, actorId)
    );
  }

  private createMemoryExportTask(resourceType: string, actorId: string | null) {
    const task = createInMemoryExportTask(resourceType, actorId, () => this.nextId());
    this.memory.importExportTasks.unshift(task);
    return Promise.resolve(task);
  }

  private nextId(): string {
    const id = String(this.sequence);
    this.sequence += 1;
    return id;
  }
}

function nextScheduledRunOrThrow(cronExpression: string, nowIsoValue: string): string {
  try {
    return computeNextCronRun(cronExpression, new Date(nowIsoValue));
  } catch (error) {
    throw createKnownError("VALIDATION_INVALID_REQUEST", {
      field: "cronExpression",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
