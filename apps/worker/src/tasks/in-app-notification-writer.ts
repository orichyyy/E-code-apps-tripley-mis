import { jsonParam, nowIso, type DatabaseAdapterExecutor } from "@web-admin-base/adapters";
import type { InAppNotificationDispatchPayload } from "@web-admin-base/contracts";

export function createDatabaseInAppNotificationDispatchHandler(executor: DatabaseAdapterExecutor) {
  return async (payload: InAppNotificationDispatchPayload): Promise<void> => {
    const now = nowIso();
    await executor.transaction(async () => {
      for (const userId of payload.recipientUserIds) {
        await executor.run(
          `INSERT INTO notifications (user_id, channel, title, body, status, metadata_json, is_deleted, created_at, updated_at)
           VALUES (${p(executor, 1)}, 'in_app', ${p(executor, 2)}, ${p(executor, 3)}, 'unread', ${p(executor, 4)}, ${bool(executor, false)}, ${p(executor, 5)}, ${p(executor, 6)})`,
          [
            userId,
            payload.title,
            payload.body,
            jsonParam({ ...payload.metadata, createdBy: payload.createdBy }, executor.dialect),
            now,
            now,
          ],
        );
      }
    });
  };
}

function p(executor: DatabaseAdapterExecutor, index: number): string {
  return executor.dialect === "postgresql" ? `$${index}` : "?";
}

function bool(executor: DatabaseAdapterExecutor, value: boolean): string {
  if (executor.dialect === "postgresql") return value ? "TRUE" : "FALSE";
  return value ? "1" : "0";
}
