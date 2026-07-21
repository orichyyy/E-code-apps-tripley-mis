import type { BusinessWorkerModuleRegistration } from "@web-admin-base/contracts";
import { selectActiveModuleRegistrations } from "@web-admin-base/module-sdk";

export const businessWorkerModuleRegistry: readonly BusinessWorkerModuleRegistration[] = [];

export function selectActiveBusinessWorkerModules(activeModuleCodes: ReadonlySet<string>) {
  return selectActiveModuleRegistrations(businessWorkerModuleRegistry, activeModuleCodes);
}
