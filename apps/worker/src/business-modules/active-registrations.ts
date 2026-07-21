import type { DatabaseAdapterExecutor } from "@web-admin-base/adapters";
import type { BusinessWorkerModuleRegistration } from "@web-admin-base/contracts";
import { selectActiveModuleRegistrations } from "@web-admin-base/module-sdk";

export async function loadActiveBusinessWorkerRegistrations(
  executor: DatabaseAdapterExecutor,
  registrations: readonly BusinessWorkerModuleRegistration[],
): Promise<BusinessWorkerModuleRegistration[]> {
  const rows = await executor.all(
    "SELECT module_code FROM business_module_registry_entries WHERE status = 'active' ORDER BY module_code",
  );
  return selectActiveModuleRegistrations(
    registrations,
    new Set(rows.map((row) => String(row.module_code))),
  );
}
