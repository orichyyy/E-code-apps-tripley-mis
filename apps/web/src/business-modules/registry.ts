import type { BusinessWebModuleRegistration } from "@web-admin-base/contracts";
import { selectActiveModuleRegistrations } from "@web-admin-base/module-sdk";

export const businessWebModuleRegistry: readonly BusinessWebModuleRegistration[] = [];

export function selectActiveBusinessWebModules(activeModuleCodes: ReadonlySet<string>) {
  return selectActiveModuleRegistrations(businessWebModuleRegistry, activeModuleCodes);
}
