import {
  normalizeBusinessModuleDefinition,
  type BusinessModuleDefinition,
  type BusinessModuleDefinitionInput,
} from "@web-admin-base/contracts";

import { normalizeContributionOrder } from "./normalization";

export function defineBusinessModule(
  input: BusinessModuleDefinitionInput,
): BusinessModuleDefinition {
  return normalizeContributionOrder(normalizeBusinessModuleDefinition(input));
}
