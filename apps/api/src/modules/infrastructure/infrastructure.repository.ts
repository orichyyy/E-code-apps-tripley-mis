import {
  jsonParam,
  nowIso,
  readJson,
  type DatabaseAdapterExecutor,
  type DatabaseRow
} from "@web-admin-base/adapters";
import { loadDatabaseConfig } from "@web-admin-base/db";

import {
  createPostgresqlInfrastructureExecutor,
  createSqliteInfrastructureExecutor
} from "./infrastructure.executor";
import type { StoredFileMetadataInput } from "./file-management";
import type { InAppNotificationRecordInput } from "./in-app-notification-dispatcher";
import type { LogType, ScheduledTaskInput } from "./infrastructure.types";

export class InfrastructureRepository {
  constructor(public readonly executor: DatabaseAdapterExecutor) {}

  static fromEnvironment(env: NodeJS.ProcessEnv = process.env): InfrastructureRepository {
    const config = loadDatabaseConfig(env);
    const executor =
      config.dialect === "postgresql"
        ? createPostgresqlInfrastructureExecutor(config.url)
        : createSqliteInfrastructureExecutor(config.url);
    return new InfrastructureRepository(executor);
  }

  close(): Promise<void> {
    return this.executor.close();
  }

  async listLogs(logType: LogType) {
    const rows = await this.executor.all(
      `SELECT id, log_type, level, message, trace_id, user_id, ip_address, metadata_json, occurred_at, created_at
       FROM log_entries WHERE log_type = ${this.p(1)} ORDER BY occurred_at DESC, id DESC LIMIT 100`,
      [logType]
    );
    return rows.map((row) => ({
      id: String(row.id),
      logType: String(row.log_type),
      level: String(row.level),
      message: String(row.message),
      traceId: nullableString(row.trace_id),
      userId: nullableId(row.user_id),
      ipAddress: nullableString(row.ip_address),
      metadata: readJson(row.metadata_json),
      occurredAt: iso(row.occurred_at),
      createdAt: iso(row.created_at)
    }));
  }

  async createLogExportTask(logType: LogType, createdBy: string | null) {
    return this.createImportExportTask("export", `logs:${logType}`, createdBy);
  }

  async listFiles() {
    const rows = await this.executor.all(
      `SELECT id, object_key, original_name, content_type, extension, size_bytes, storage_driver, status, referenced, is_deleted, created_at, updated_at
       FROM file_objects ORDER BY id DESC LIMIT 100`
    );
    return rows.map(toFileRecord);
  }

  async getFile(id: string) {
    const rows = await this.executor.all(
      `SELECT id, object_key, original_name, content_type, extension, size_bytes, storage_driver, status, referenced, is_deleted, created_at, updated_at
       FROM file_objects WHERE id = ${this.p(1)} LIMIT 1`,
      [id]
    );
    return rows[0] ? toFileRecord(rows[0]) : null;
  }

  async createFile(input: StoredFileMetadataInput) {
    const now = nowIso();
    await this.executor.run(
      `INSERT INTO file_objects (object_key, original_name, content_type, extension, size_bytes, storage_driver, status, referenced, is_deleted, created_at, updated_at, created_by, updated_by)
       VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, ${this.p(4)}, ${this.p(5)}, ${this.p(6)}, 'active', ${this.bool(false)}, ${this.bool(false)}, ${this.p(7)}, ${this.p(8)}, ${this.p(9)}, ${this.p(10)})`,
      [
        input.objectKey,
        input.originalName,
        input.contentType,
        input.extension,
        input.sizeBytes,
        input.storageDriver,
        now,
        now,
        input.actorId,
        input.actorId
      ]
    );
    const rows = await this.executor.all(
      `SELECT id, object_key, original_name, content_type, extension, size_bytes, storage_driver, status, referenced, is_deleted, created_at, updated_at
       FROM file_objects WHERE object_key = ${this.p(1)} LIMIT 1`,
      [input.objectKey]
    );
    return rows[0] ? toFileRecord(rows[0]) : null;
  }

  async deleteFile(id: string, deletedBy: string | null) {
    const now = nowIso();
    await this.executor.transaction(async () => {
      await this.executor.run(
        `UPDATE file_objects SET status = 'invalid', is_deleted = ${this.bool(true)}, deleted_at = ${this.p(1)}, deleted_by = ${this.p(2)}, updated_at = ${this.p(3)} WHERE id = ${this.p(4)}`,
        [now, deletedBy, now, id]
      );
      await this.executor.run(
        `UPDATE file_references SET status = 'invalid' WHERE file_object_id = ${this.p(1)}`,
        [id]
      );
    });
    return this.getFile(id);
  }

  async listFileReferences(fileId: string) {
    const rows = await this.executor.all(
      `SELECT id, file_object_id, resource_type, resource_id, reference_type, status, created_at, created_by
       FROM file_references WHERE file_object_id = ${this.p(1)} ORDER BY id DESC LIMIT 100`,
      [fileId]
    );
    return rows.map((row) => ({
      id: String(row.id),
      fileObjectId: String(row.file_object_id),
      resourceType: String(row.resource_type),
      resourceId: String(row.resource_id),
      referenceType: String(row.reference_type),
      status: String(row.status),
      createdAt: iso(row.created_at),
      createdBy: nullableId(row.created_by)
    }));
  }

  async listNotifications(userId: string) {
    const rows = await this.executor.all(
      `SELECT id, user_id, channel, title, body, status, metadata_json, read_at, archived_at, created_at, updated_at
       FROM notifications WHERE is_deleted = ${this.bool(false)}
       AND (user_id IS NULL OR user_id = ${this.p(1)}) ORDER BY id DESC LIMIT 100`,
      [userId]
    );
    return rows.map((row) => ({
      id: String(row.id),
      userId: nullableId(row.user_id),
      channel: String(row.channel),
      title: String(row.title),
      body: String(row.body),
      status: String(row.status),
      metadata: readJson(row.metadata_json),
      readAt: nullableIso(row.read_at),
      archivedAt: nullableIso(row.archived_at),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at)
    }));
  }

  async updateNotificationStatus(id: string, status: "read" | "archived" | "deleted", deletedBy: string | null) {
    const now = nowIso();
    if (status === "read") {
      await this.executor.run(
        `UPDATE notifications SET status = ${this.p(1)}, read_at = ${this.p(2)}, updated_at = ${this.p(3)} WHERE id = ${this.p(4)}`,
        [status, now, now, id]
      );
    } else if (status === "archived") {
      await this.executor.run(
        `UPDATE notifications SET status = ${this.p(1)}, archived_at = ${this.p(2)}, updated_at = ${this.p(3)} WHERE id = ${this.p(4)}`,
        [status, now, now, id]
      );
    } else {
      await this.executor.run(
        `UPDATE notifications SET status = ${this.p(1)}, is_deleted = ${this.bool(true)}, deleted_at = ${this.p(2)}, deleted_by = ${this.p(3)}, updated_at = ${this.p(4)} WHERE id = ${this.p(5)}`,
        [status, now, deletedBy, now, id]
      );
    }
    return { id, status };
  }

  async createInAppNotifications(records: InAppNotificationRecordInput[]): Promise<void> {
    if (records.length === 0) return;
    const now = nowIso();
    await this.executor.transaction(async () => {
      for (const record of records) {
        await this.executor.run(
          `INSERT INTO notifications (user_id, channel, title, body, status, metadata_json, is_deleted, created_at, updated_at)
           VALUES (${this.p(1)}, 'in_app', ${this.p(2)}, ${this.p(3)}, 'unread', ${this.p(4)}, ${this.bool(false)}, ${this.p(5)}, ${this.p(6)})`,
          [
            record.userId,
            record.title,
            record.body,
            jsonParam({ ...record.metadata, createdBy: record.createdBy }, this.executor.dialect),
            now,
            now
          ]
        );
      }
    });
  }

  async listEnabledUserIdsForOrganization(organizationId: string): Promise<string[]> {
    const rows = await this.executor.all(
      `SELECT DISTINCT u.id
       FROM user_organization_roles uor
       JOIN users u ON u.id = uor.user_id
       JOIN organizations o ON o.id = uor.organization_id
       WHERE uor.organization_id = ${this.p(1)}
       AND uor.status = 'enabled'
       AND uor.is_deleted = ${this.bool(false)}
       AND u.status = 'enabled'
       AND u.is_deleted = ${this.bool(false)}
       AND o.status = 'enabled'
       AND o.is_deleted = ${this.bool(false)}
       ORDER BY u.id ASC`,
      [organizationId]
    );
    return rows.map((row) => String(row.id));
  }

  async listNotificationTemplates() {
    const rows = await this.executor.all(
      `SELECT id, code, channel, locale, subject, body, variables_json, status, created_at, updated_at
       FROM notification_templates ORDER BY code, locale LIMIT 100`
    );
    return rows.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      channel: String(row.channel),
      locale: String(row.locale),
      subject: nullableString(row.subject),
      body: String(row.body),
      variables: readJson(row.variables_json),
      status: String(row.status),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at)
    }));
  }

  async createNotificationTemplate(input: {
    code: string;
    channel: string;
    locale: string;
    subject?: string | null;
    body: string;
    variables: string[];
  }) {
    const now = nowIso();
    await this.executor.run(
      `INSERT INTO notification_templates (code, channel, locale, subject, body, variables_json, status, created_at, updated_at)
       VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, ${this.p(4)}, ${this.p(5)}, ${this.p(6)}, 'enabled', ${this.p(7)}, ${this.p(8)})`,
      [
        input.code,
        input.channel,
        input.locale,
        input.subject ?? null,
        input.body,
        jsonParam(input.variables, this.executor.dialect),
        now,
        now
      ]
    );
    return lastByCode(this.listNotificationTemplates(), input.code, input.locale);
  }

  async updateNotificationTemplate(id: string, input: Record<string, unknown>) {
    const templates = await this.listNotificationTemplates();
    const current = templates.find((template) => template.id === id);
    if (!current) return null;
    const next = { ...current, ...input };
    await this.executor.run(
      `UPDATE notification_templates SET code = ${this.p(1)}, channel = ${this.p(2)}, locale = ${this.p(3)}, subject = ${this.p(4)}, body = ${this.p(5)}, variables_json = ${this.p(6)}, updated_at = ${this.p(7)} WHERE id = ${this.p(8)}`,
      [
        next.code,
        next.channel,
        next.locale,
        next.subject ?? null,
        next.body,
        jsonParam(next.variables, this.executor.dialect),
        nowIso(),
        id
      ]
    );
    return (await this.listNotificationTemplates()).find((template) => template.id === id) ?? null;
  }

  async listScheduledTasks() {
    const rows = await this.executor.all(
      `SELECT id, code, cron_expression, handler_type, payload_json, status, last_run_at, next_run_at, attempt, max_attempts, last_error, created_at, updated_at
       FROM scheduled_jobs ORDER BY id DESC LIMIT 100`
    );
    return rows.map(toScheduledTask);
  }

  async createScheduledTask(input: ScheduledTaskInput) {
    const now = nowIso();
    await this.executor.run(
      `INSERT INTO scheduled_jobs (code, cron_expression, handler_type, payload_json, status, next_run_at, created_at, updated_at)
       VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, ${this.p(4)}, ${this.p(5)}, ${this.p(6)}, ${this.p(7)}, ${this.p(8)})`,
      [
        input.code,
        input.cronExpression,
        input.handlerType,
        jsonParam(input.payload, this.executor.dialect),
        input.enabled ? "enabled" : "disabled",
        now,
        now,
        now
      ]
    );
    return lastByCode(this.listScheduledTasks(), input.code);
  }

  async updateScheduledTask(id: string, input: Partial<ScheduledTaskInput>) {
    const current = (await this.listScheduledTasks()).find((task) => task.id === id);
    if (!current) return null;
    const next = { ...current, ...input };
    await this.executor.run(
      `UPDATE scheduled_jobs SET code = ${this.p(1)}, cron_expression = ${this.p(2)}, handler_type = ${this.p(3)}, payload_json = ${this.p(4)}, status = ${this.p(5)}, updated_at = ${this.p(6)} WHERE id = ${this.p(7)}`,
      [
        next.code,
        next.cronExpression,
        next.handlerType,
        jsonParam(next.payload, this.executor.dialect),
        next.enabled ? "enabled" : "disabled",
        nowIso(),
        id
      ]
    );
    return (await this.listScheduledTasks()).find((task) => task.id === id) ?? null;
  }

  async setScheduledTaskStatus(id: string, enabled: boolean) {
    await this.executor.run(
      `UPDATE scheduled_jobs SET status = ${this.p(1)}, updated_at = ${this.p(2)} WHERE id = ${this.p(3)}`,
      [enabled ? "enabled" : "disabled", nowIso(), id]
    );
    return (await this.listScheduledTasks()).find((task) => task.id === id) ?? null;
  }

  async enqueueScheduledTaskRun(id: string) {
    const task = (await this.listScheduledTasks()).find((item) => item.id === id);
    if (!task) return null;
    const now = nowIso();
    await this.executor.run(
      `INSERT INTO queue_jobs (type, payload_json, status, attempt, max_attempts, available_at, created_at, updated_at)
       VALUES ('scheduled.run', ${this.p(1)}, 'pending', 0, 1, ${this.p(2)}, ${this.p(3)}, ${this.p(4)})`,
      [jsonParam({ scheduledTaskId: id, handlerType: task.handlerType }, this.executor.dialect), now, now, now]
    );
    return task;
  }

  async listImportExportTasks() {
    const rows = await this.executor.all(
      `SELECT id, task_type, resource_type, status, file_object_id, result_file_object_id, error_file_object_id,
        total_rows, success_rows, failed_rows, error_preview_json, result_expires_at, created_at, updated_at, created_by
       FROM import_export_tasks ORDER BY id DESC LIMIT 100`
    );
    return rows.map((row) => ({
      id: String(row.id),
      taskType: String(row.task_type),
      resourceType: String(row.resource_type),
      status: String(row.status),
      fileObjectId: nullableId(row.file_object_id),
      resultFileObjectId: nullableId(row.result_file_object_id),
      errorFileObjectId: nullableId(row.error_file_object_id),
      totalRows: Number(row.total_rows),
      successRows: Number(row.success_rows),
      failedRows: Number(row.failed_rows),
      errorPreview: readJson(row.error_preview_json),
      resultExpiresAt: nullableIso(row.result_expires_at),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      createdBy: nullableId(row.created_by)
    }));
  }

  async getImportExportTask(id: string) {
    return (await this.listImportExportTasks()).find((task) => task.id === id) ?? null;
  }

  async createExportTask(resourceType: string, createdBy: string | null) {
    return this.createImportExportTask("export", resourceType, createdBy);
  }

  private async createImportExportTask(taskType: "export" | "import", resourceType: string, createdBy: string | null) {
    const now = nowIso();
    const resultExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await this.executor.run(
      `INSERT INTO import_export_tasks (task_type, resource_type, status, error_preview_json, result_expires_at, created_at, updated_at, created_by)
       VALUES (${this.p(1)}, ${this.p(2)}, 'pending', ${this.p(3)}, ${this.p(4)}, ${this.p(5)}, ${this.p(6)}, ${this.p(7)})`,
      [taskType, resourceType, jsonParam([], this.executor.dialect), resultExpiresAt, now, now, createdBy]
    );
    const tasks = await this.listImportExportTasks();
    return tasks.find((task) => task.resourceType === resourceType && task.taskType === taskType) ?? tasks[0];
  }

  private p(index: number): string {
    return this.executor.dialect === "postgresql" ? `$${index}` : "?";
  }

  private bool(value: boolean): string {
    return this.executor.dialect === "postgresql" ? String(value).toUpperCase() : value ? "1" : "0";
  }
}

function toScheduledTask(row: DatabaseRow) {
  return {
    id: String(row.id),
    code: String(row.code),
    cronExpression: String(row.cron_expression),
    handlerType: String(row.handler_type),
    payload: readJson(row.payload_json),
    enabled: row.status === "enabled",
    status: String(row.status),
    lastRunAt: nullableIso(row.last_run_at),
    nextRunAt: nullableIso(row.next_run_at),
    attempt: Number(row.attempt),
    maxAttempts: Number(row.max_attempts),
    lastError: nullableString(row.last_error),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function toFileRecord(row: DatabaseRow) {
  return {
    id: String(row.id),
    objectKey: String(row.object_key),
    originalName: String(row.original_name),
    contentType: String(row.content_type),
    extension: String(row.extension),
    sizeBytes: Number(row.size_bytes),
    storageDriver: String(row.storage_driver),
    status: String(row.status),
    referenced: Boolean(row.referenced),
    isDeleted: Boolean(row.is_deleted),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

async function lastByCode<T extends { code: string; id: string }>(
  recordsPromise: Promise<T[]>,
  code: string,
  locale?: string
) {
  const records = await recordsPromise;
  return records.find((record) => record.code === code && (!locale || "locale" in record && record.locale === locale)) ?? records[0];
}

function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function nullableIso(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value);
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function nullableId(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}
