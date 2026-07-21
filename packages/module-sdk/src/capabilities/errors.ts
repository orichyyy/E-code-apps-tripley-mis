import type { LocalizedMessage } from "@web-admin-base/contracts";

export class BusinessModuleCapabilityError extends Error {
  readonly code = "PERMISSION_MODULE_CAPABILITY_DENIED";
  readonly status = 403;

  constructor(message: string) {
    super(message);
    this.name = "BusinessModuleCapabilityError";
  }
}

export class BusinessModuleDeclaredError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly localizedMessage: LocalizedMessage,
    readonly details?: unknown,
  ) {
    super(localizedMessage.defaultMessage);
    this.name = "BusinessModuleDeclaredError";
  }
}

export function capabilityDenied(message: string): never {
  throw new BusinessModuleCapabilityError(message);
}
