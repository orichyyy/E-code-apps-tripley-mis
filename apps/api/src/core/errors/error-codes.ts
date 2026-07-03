import { appError, type AppError } from "./app-error";

const errorDefinitions = {
  AUTH_ACCOUNT_DISABLED: ["Account is disabled", 403, "authentication"],
  AUTH_ACCOUNT_LOCKED: ["Account is locked", 423, "authentication"],
  AUTH_CSRF_TOKEN_INVALID: ["CSRF token is invalid", 403, "authentication"],
  AUTH_INVALID_CREDENTIALS: ["Username or password is invalid", 401, "authentication"],
  AUTH_PASSWORD_CHANGE_REQUIRED: ["Password change is required", 403, "authentication"],
  AUTH_SESSION_NOT_FOUND: ["Session was not found", 401, "authentication"],
  AUTH_TOKEN_EXPIRED: ["Authentication token is expired", 401, "authentication"],
  AUTH_TOKEN_INVALIDATED: ["Authentication token has been invalidated", 401, "authentication"],
  BUSINESS_MAX_ORG_DEPTH_EXCEEDED: ["Organization maximum depth exceeded", 409, "business"],
  BUSINESS_NO_ENABLED_ORGANIZATION: ["User has no enabled organization", 403, "business"],
  BUSINESS_ORG_DISABLED: ["Organization is disabled", 409, "business"],
  BUSINESS_ORG_SEGMENT_RANGE_EXHAUSTED: [
    "Organization sibling segment range is exhausted",
    409,
    "business"
  ],
  BUSINESS_ROLE_DISABLED: ["Role is disabled", 409, "business"],
  BUSINESS_SYSTEM_ALREADY_INITIALIZED: ["System is already initialized", 409, "business"],
  MENU_NOT_FOUND: ["Menu was not found", 404, "business"],
  ORGANIZATION_NOT_FOUND: ["Organization was not found", 404, "business"],
  PERMISSION_API_DENIED: ["API permission denied", 403, "authorization"],
  PERMISSION_DENIED: ["Permission denied", 403, "authorization"],
  PERMISSION_UNKNOWN_CODE: ["Permission code is unknown", 400, "validation"],
  ROLE_NOT_FOUND: ["Role was not found", 404, "business"],
  SYSTEM_INTERNAL_ERROR: ["Unexpected internal error", 500, "system"],
  THIRD_PARTY_INTEGRATION_FAILED: ["Third-party integration failed", 502, "third-party"],
  USER_NOT_FOUND: ["User was not found", 404, "business"],
  VALIDATION_DUPLICATE_EMAIL: ["Email already exists", 409, "validation"],
  VALIDATION_DUPLICATE_MENU_CODE: ["Menu code already exists", 409, "validation"],
  VALIDATION_DUPLICATE_MENU_PATH: ["Menu path already exists", 409, "validation"],
  VALIDATION_DUPLICATE_ORGANIZATION_CODE: ["Organization code already exists", 409, "validation"],
  VALIDATION_DUPLICATE_PHONE: ["Phone number already exists", 409, "validation"],
  VALIDATION_DUPLICATE_ROLE_CODE: ["Role code already exists", 409, "validation"],
  VALIDATION_DUPLICATE_USERNAME: ["Username already exists", 409, "validation"],
  VALIDATION_INVALID_REQUEST: ["Request validation failed", 400, "validation"],
  VALIDATION_PASSWORD_POLICY: ["Password does not satisfy policy", 400, "validation"],
  VALIDATION_REQUIRED_FIELD: ["Required field is missing", 400, "validation"],
  PASSWORD_MIN_LENGTH: ["Password is too short", 400, "validation"],
  PASSWORD_REQUIRES_LETTER: ["Password must contain a letter", 400, "validation"],
  PASSWORD_REQUIRES_NUMBER: ["Password must contain a number", 400, "validation"]
} as const satisfies Record<string, readonly [string, number, string]>;

export type KnownErrorCode = keyof typeof errorDefinitions;

export type ErrorCodeDefinition = {
  code: KnownErrorCode;
  message: string;
  status: number;
  category: AppError["category"];
};

export function createKnownError(code: KnownErrorCode, details?: unknown): AppError {
  const [message, status, category] = errorDefinitions[code];
  return appError({
    code,
    message,
    status,
    category: category as AppError["category"],
    details
  });
}

export function isKnownErrorCode(code: string): code is KnownErrorCode {
  return code in errorDefinitions;
}

export function listErrorCodeDefinitions(): ErrorCodeDefinition[] {
  return Object.entries(errorDefinitions).map(([code, [message, status, category]]) => ({
    code: code as KnownErrorCode,
    message,
    status,
    category: category as AppError["category"]
  }));
}
