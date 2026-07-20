import {
  businessModuleRegistryResponseSchema,
  moduleSyncApplyResponseSchema,
  moduleSyncPlanResponseSchema,
  type BusinessModuleRegistryResponse,
  type ModuleSyncApplyResponse,
  type ModuleSyncPlanResponse,
} from "@web-admin-base/contracts";

import { requestJson } from "@/lib/api-request";

export async function fetchModuleRegistry(): Promise<BusinessModuleRegistryResponse> {
  const response = await requestJson<{ data: unknown }>("/modules/registry");
  return businessModuleRegistryResponseSchema.parse(response.data);
}

export async function fetchModuleSyncPlan(): Promise<ModuleSyncPlanResponse> {
  const response = await requestJson<{ data: unknown }>("/modules/sync/plan", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return moduleSyncPlanResponseSchema.parse(response.data);
}

export async function applyModuleSync(
  expectedRegistryHash: string,
): Promise<ModuleSyncApplyResponse> {
  const response = await requestJson<{ data: unknown }>("/modules/sync/apply", {
    method: "POST",
    body: JSON.stringify({ expectedRegistryHash, confirmed: true }),
  });
  return moduleSyncApplyResponseSchema.parse(response.data);
}
