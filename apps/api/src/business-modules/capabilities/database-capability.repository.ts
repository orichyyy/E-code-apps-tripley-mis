import {
  jsonParam,
  nowIso,
  type DatabaseAdapterExecutor,
  type DatabaseRow,
} from "@web-admin-base/adapters";
import type {
  ModuleAsyncMessage,
  ModuleCsvTask,
  ModuleExecutionContext,
  ModuleFileReference,
} from "@web-admin-base/contracts";

export class DatabaseBusinessModuleCapabilityRepository {
  constructor(private readonly executor: DatabaseAdapterExecutor) {}

  async attachFile(input: {
    context: ModuleExecutionContext;
    fileId: string;
    resourceId: string;
    resourceType: string;
    attachmentCode: string;
    cardinality: "single" | "multiple";
  }): Promise<ModuleFileReference> {
    return this.executor.transaction(async () => {
      const existing = await this.findReference(input);
      if (existing?.status === "active") return existing;
      if (input.cardinality === "single") await this.invalidateSiblingReferences(input);
      const createdAt = nowIso();
      await this.executor.run(
        `INSERT INTO file_references
          (file_object_id, resource_type, resource_id, reference_type, status, created_at, created_by)
         VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, ${this.p(4)}, 'active', ${this.p(5)}, ${this.p(6)})`,
        [
          input.fileId,
          input.resourceType,
          input.resourceId,
          input.attachmentCode,
          createdAt,
          input.context.actorId,
        ],
      );
      await this.executor.run(
        `UPDATE file_objects SET referenced = ${this.bool(true)}, updated_at = ${this.p(1)}
         WHERE id = ${this.p(2)}`,
        [createdAt, input.fileId],
      );
      const created = await this.findReference(input);
      if (!created) throw new Error("Managed File reference was not persisted.");
      return created;
    });
  }

  async detachFile(input: {
    fileId: string;
    resourceId: string;
    resourceType: string;
    attachmentCode: string;
  }): Promise<void> {
    await this.executor.transaction(async () => {
      await this.executor.run(
        `UPDATE file_references SET status = 'invalid'
         WHERE file_object_id = ${this.p(1)} AND resource_type = ${this.p(2)}
         AND resource_id = ${this.p(3)} AND reference_type = ${this.p(4)} AND status = 'active'`,
        [input.fileId, input.resourceType, input.resourceId, input.attachmentCode],
      );
      const active = await this.executor.all(
        `SELECT id FROM file_references WHERE file_object_id = ${this.p(1)} AND status = 'active'
         LIMIT 1`,
        [input.fileId],
      );
      if (active.length === 0) {
        await this.executor.run(
          `UPDATE file_objects SET referenced = ${this.bool(false)}, updated_at = ${this.p(1)}
           WHERE id = ${this.p(2)}`,
          [nowIso(), input.fileId],
        );
      }
    });
  }

  async createCsvTask(input: {
    message: ModuleAsyncMessage;
    taskType: "import" | "export";
    resourceType: string;
    fileId?: string;
    filters?: Record<string, unknown>;
    exportFields: string[];
  }): Promise<ModuleCsvTask> {
    const existing = await this.findCsvTask(
      input.taskType,
      input.resourceType,
      input.message.idempotencyKey,
    );
    if (existing) return existing;
    const timestamp = nowIso();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await this.executor.run(
      `INSERT INTO import_export_tasks
        (idempotency_key, task_type, resource_type, status, file_object_id, error_preview_json,
         request_json, execution_context_json, result_expires_at, created_at, updated_at, created_by)
       VALUES (${this.p(1)}, ${this.p(2)}, ${this.p(3)}, 'pending', ${this.p(4)}, ${this.p(5)},
        ${this.p(6)}, ${this.p(7)}, ${this.p(8)}, ${this.p(9)}, ${this.p(10)}, ${this.p(11)})
       ON CONFLICT (task_type, resource_type, idempotency_key) DO NOTHING`,
      [
        input.message.idempotencyKey,
        input.taskType,
        input.resourceType,
        input.fileId ?? null,
        jsonParam([], this.executor.dialect),
        jsonParam(
          { filters: input.filters ?? {}, exportFields: input.exportFields },
          this.executor.dialect,
        ),
        jsonParam(input.message.context, this.executor.dialect),
        expiresAt,
        timestamp,
        timestamp,
        input.message.context.actorId,
      ],
    );
    const created = await this.findCsvTask(
      input.taskType,
      input.resourceType,
      input.message.idempotencyKey,
    );
    if (!created) throw new Error("CSV task was not persisted.");
    return created;
  }

  private async invalidateSiblingReferences(input: {
    resourceType: string;
    resourceId: string;
    attachmentCode: string;
  }): Promise<void> {
    await this.executor.run(
      `UPDATE file_references SET status = 'invalid'
       WHERE resource_type = ${this.p(1)} AND resource_id = ${this.p(2)}
       AND reference_type = ${this.p(3)} AND status = 'active'`,
      [input.resourceType, input.resourceId, input.attachmentCode],
    );
  }

  private async findReference(input: {
    fileId: string;
    resourceType: string;
    resourceId: string;
    attachmentCode: string;
  }): Promise<ModuleFileReference | null> {
    const rows = await this.executor.all(
      `SELECT id, file_object_id, resource_type, resource_id, reference_type, status, created_at
       FROM file_references WHERE file_object_id = ${this.p(1)} AND resource_type = ${this.p(2)}
       AND resource_id = ${this.p(3)} AND reference_type = ${this.p(4)}
       ORDER BY id DESC LIMIT 1`,
      [input.fileId, input.resourceType, input.resourceId, input.attachmentCode],
    );
    return rows[0] ? toReference(rows[0]) : null;
  }

  private async findCsvTask(
    taskType: string,
    resourceType: string,
    idempotencyKey: string,
  ): Promise<ModuleCsvTask | null> {
    const rows = await this.executor.all(
      `SELECT id, task_type, resource_type, status, request_json
       FROM import_export_tasks WHERE task_type = ${this.p(1)} AND resource_type = ${this.p(2)}
       AND idempotency_key = ${this.p(3)} LIMIT 1`,
      [taskType, resourceType, idempotencyKey],
    );
    if (!rows[0]) return null;
    return {
      id: String(rows[0].id),
      taskType: String(rows[0].task_type) as "import" | "export",
      resourceType: String(rows[0].resource_type),
      status: String(rows[0].status) as ModuleCsvTask["status"],
    };
  }

  private p(index: number): string {
    return this.executor.dialect === "postgresql" ? `$${index}` : "?";
  }

  private bool(value: boolean): string {
    return this.executor.dialect === "postgresql" ? String(value).toUpperCase() : value ? "1" : "0";
  }
}

function toReference(row: DatabaseRow): ModuleFileReference {
  return {
    id: String(row.id),
    fileId: String(row.file_object_id),
    resourceType: String(row.resource_type),
    resourceId: String(row.resource_id),
    attachmentCode: String(row.reference_type),
    status: String(row.status) as ModuleFileReference["status"],
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}
