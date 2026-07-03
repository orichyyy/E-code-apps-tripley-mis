import type {
  CreateExportTaskRequest,
  CreateLogExportTaskRequest,
  CreateNotificationTemplateRequest,
  CreateScheduledTaskRequest,
  UpdateNotificationTemplateRequest,
  UpdateScheduledTaskRequest
} from "@web-admin-base/contracts";

import { InfrastructureRepository } from "./infrastructure.repository";
import type { LogType, ScheduledTaskInput } from "./infrastructure.types";

export class InfrastructureServices {
  private readonly memory = {
    files: [] as Array<Record<string, unknown> & { id: string }>,
    importExportTasks: [] as Array<Record<string, unknown> & { id: string; resourceType: string; taskType: string }>,
    logs: [] as Array<Record<string, unknown> & { id: string; logType: LogType }>,
    notifications: [] as Array<Record<string, unknown> & { id: string; status: string }>,
    scheduledTasks: [] as Array<Record<string, unknown> & { id: string; code: string; enabled: boolean }>,
    templates: [] as Array<Record<string, unknown> & { id: string; code: string; locale: string }>
  };
  private sequence = 1;

  constructor(private readonly repository?: InfrastructureRepository) {}

  static inMemory(): InfrastructureServices {
    return new InfrastructureServices();
  }

  static database(repository = InfrastructureRepository.fromEnvironment()): InfrastructureServices {
    return new InfrastructureServices(repository);
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
