import type { FileStorageAdapter, NotificationChannelAdapter } from "@web-admin-base/adapters";
import type {
  CreateExportTaskRequest,
  CreateLogExportTaskRequest,
  CreateNotificationTemplateRequest,
  CreateScheduledTaskRequest,
  SendTestEmailNotificationRequest,
  UpdateNotificationTemplateRequest,
  UpdateScheduledTaskRequest
} from "@web-admin-base/contracts";

import { createKnownError } from "../../core/errors/error-codes";
import { sendTestEmailNotification, type NotificationTemplateRecord } from "./email-notification-sender";
import {
  createObjectKey,
  isPreviewableImage,
  validateUploadInput,
  type FileUploadInput
} from "./file-management";
import { InfrastructureRepository } from "./infrastructure.repository";
import {
  createDefaultFileStorage,
  createDefaultNotificationChannel,
  readMaxFileSizeBytes,
  resolveInfrastructureServiceOptions,
  type InfrastructureServiceOptions
} from "./infrastructure-service-options";
import type { LogType, ScheduledTaskInput } from "./infrastructure.types";

export class InfrastructureServices {
  private readonly memory = {
    files: [] as Array<Record<string, unknown> & { id: string }>,
    importExportTasks: [] as Array<Record<string, unknown> & { id: string; resourceType: string; taskType: string }>,
    logs: [] as Array<Record<string, unknown> & { id: string; logType: LogType }>,
    notifications: [] as Array<Record<string, unknown> & { id: string; status: string }>,
    scheduledTasks: [] as Array<Record<string, unknown> & { id: string; code: string; enabled: boolean }>,
    templates: [] as NotificationTemplateRecord[]
  };
  private sequence = 1;

  constructor(
    private readonly repository?: InfrastructureRepository,
    private readonly storage: FileStorageAdapter = createDefaultFileStorage(),
    private readonly maxFileSizeBytes = readMaxFileSizeBytes(),
    private readonly notificationChannel: NotificationChannelAdapter = createDefaultNotificationChannel()
  ) {}

  static inMemory(options?: FileStorageAdapter | InfrastructureServiceOptions): InfrastructureServices {
    const resolved = resolveInfrastructureServiceOptions(options);
    return new InfrastructureServices(
      undefined,
      resolved.storage,
      resolved.maxFileSizeBytes,
      resolved.notificationChannel
    );
  }

  static database(
    repository = InfrastructureRepository.fromEnvironment(),
    options?: FileStorageAdapter | InfrastructureServiceOptions
  ): InfrastructureServices {
    const resolved = resolveInfrastructureServiceOptions(options);
    return new InfrastructureServices(
      repository,
      resolved.storage,
      resolved.maxFileSizeBytes,
      resolved.notificationChannel
    );
  }

  close(): Promise<void> {
    return this.repository?.close() ?? Promise.resolve();
  }

  listLogs(logType: LogType) {
    return this.repository?.listLogs(logType) ?? Promise.resolve(this.memory.logs.filter((log) => log.logType === logType));
  }

  createLogExportTask(input: CreateLogExportTaskRequest, actorId: string | null) {
    return this.repository?.createLogExportTask(input.logType, actorId) ?? this.createMemoryExportTask(`logs:${input.logType}`, actorId);
  }

  listFiles() {
    return this.repository?.listFiles() ?? Promise.resolve(this.memory.files);
  }

  getFile(id: string) {
    return this.repository?.getFile(id) ?? Promise.resolve(this.memory.files.find((file) => file.id === id) ?? null);
  }

  async uploadFile(input: FileUploadInput) {
    const normalized = validateUploadInput(input, this.maxFileSizeBytes);
    const objectKey = createObjectKey(normalized.extension);
    const stored = await this.storage.put(objectKey, input.body, normalized.contentType);
    const metadata = {
      objectKey: stored.objectKey,
      originalName: normalized.originalName,
      contentType: stored.contentType,
      extension: normalized.extension,
      sizeBytes: stored.sizeBytes,
      storageDriver: "local",
      actorId: input.actorId
    };
    if (this.repository) return this.repository.createFile(metadata);
    const now = new Date().toISOString();
    const file = {
      id: this.nextId(),
      ...metadata,
      status: "active",
      referenced: false,
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    };
    this.memory.files.unshift(file);
    return file;
  }

  async getFileContent(id: string, mode: "download" | "preview") {
    const file = await this.getFile(id);
    if (!file || file.isDeleted || file.status === "invalid") throw createKnownError("FILE_NOT_FOUND");
    if (mode === "preview" && !isPreviewableImage(String(file.contentType))) {
      throw createKnownError("FILE_PREVIEW_NOT_SUPPORTED");
    }
    const body = await this.storage.get(String(file.objectKey));
    if (!body) throw createKnownError("FILE_NOT_FOUND");
    return { file, body };
  }

  deleteFile(id: string, actorId: string | null) {
    if (this.repository) return this.repository.deleteFile(id, actorId);
    const file = this.memory.files.find((item) => item.id === id);
    if (!file) return Promise.resolve(null);
    Object.assign(file, {
      status: "invalid",
      isDeleted: true,
      deletedBy: actorId,
      deletedAt: new Date().toISOString()
    });
    return Promise.resolve(file);
  }

  listFileReferences(id: string) {
    return this.repository?.listFileReferences(id) ?? Promise.resolve([]);
  }

  listNotifications(userId: string) {
    return this.repository?.listNotifications(userId) ?? Promise.resolve(this.memory.notifications);
  }

  updateNotificationStatus(id: string, status: "read" | "archived" | "deleted", actorId: string | null) {
    if (this.repository) return this.repository.updateNotificationStatus(id, status, actorId);
    const notification = this.memory.notifications.find((item) => item.id === id);
    if (notification) notification.status = status;
    return Promise.resolve(notification ?? { id, status });
  }

  listNotificationTemplates() {
    return this.repository?.listNotificationTemplates() ?? Promise.resolve(this.memory.templates);
  }

  createNotificationTemplate(input: CreateNotificationTemplateRequest) {
    if (this.repository) return this.repository.createNotificationTemplate(input);
    const now = new Date().toISOString();
    const template = {
      id: this.nextId(),
      ...input,
      subject: input.subject ?? null,
      status: "enabled",
      createdAt: now,
      updatedAt: now
    };
    this.memory.templates.unshift(template);
    return Promise.resolve(template);
  }

  updateNotificationTemplate(id: string, input: UpdateNotificationTemplateRequest) {
    if (this.repository) return this.repository.updateNotificationTemplate(id, input);
    const template = this.memory.templates.find((item) => item.id === id);
    if (!template) return Promise.resolve(null);
    Object.assign(template, input, { updatedAt: new Date().toISOString() });
    return Promise.resolve(template);
  }

  async sendTestEmail(input: SendTestEmailNotificationRequest) {
    return sendTestEmailNotification(input, {
      listTemplates: () => this.listNotificationTemplates(),
      notificationChannel: this.notificationChannel
    });
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
      enabled: input.enabled
    };
    if (this.repository) return this.repository.createScheduledTask(normalized);
    const now = new Date().toISOString();
    const task = {
      id: this.nextId(),
      ...normalized,
      status: normalized.enabled ? "enabled" : "disabled",
      createdAt: now,
      updatedAt: now
    };
    this.memory.scheduledTasks.unshift(task);
    return Promise.resolve(task);
  }

  updateScheduledTask(id: string, input: UpdateScheduledTaskRequest) {
    if (this.repository) return this.repository.updateScheduledTask(id, input);
    const task = this.memory.scheduledTasks.find((item) => item.id === id);
    if (!task) return Promise.resolve(null);
    Object.assign(task, input, { updatedAt: new Date().toISOString() });
    return Promise.resolve(task);
  }

  setScheduledTaskStatus(id: string, enabled: boolean) {
    if (this.repository) return this.repository.setScheduledTaskStatus(id, enabled);
    const task = this.memory.scheduledTasks.find((item) => item.id === id);
    if (!task) return Promise.resolve(null);
    task.enabled = enabled;
    task.status = enabled ? "enabled" : "disabled";
    return Promise.resolve(task);
  }

  enqueueScheduledTaskRun(id: string) {
    return this.repository?.enqueueScheduledTaskRun(id) ?? Promise.resolve(this.memory.scheduledTasks.find((item) => item.id === id) ?? null);
  }

  listImportExportTasks() {
    return this.repository?.listImportExportTasks() ?? Promise.resolve(this.memory.importExportTasks);
  }

  getImportExportTask(id: string) {
    return this.repository?.getImportExportTask(id) ?? Promise.resolve(this.memory.importExportTasks.find((task) => task.id === id) ?? null);
  }

  createExportTask(input: CreateExportTaskRequest, actorId: string | null) {
    return this.repository?.createExportTask(input.resourceType, actorId) ?? this.createMemoryExportTask(input.resourceType, actorId);
  }

  private createMemoryExportTask(resourceType: string, actorId: string | null) {
    const now = new Date().toISOString();
    const task = {
      id: this.nextId(),
      taskType: "export",
      resourceType,
      status: "pending",
      totalRows: 0,
      successRows: 0,
      failedRows: 0,
      errorPreview: [],
      resultExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now,
      createdBy: actorId
    };
    this.memory.importExportTasks.unshift(task);
    return Promise.resolve(task);
  }

  private nextId(): string {
    const id = String(this.sequence);
    this.sequence += 1;
    return id;
  }
}
