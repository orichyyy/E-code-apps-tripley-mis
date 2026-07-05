import { ZodError } from "zod";

import { AppError, isAppError } from "./app-error";
import { createKnownError, isKnownErrorCode } from "./error-codes";

export type ErrorResponseBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
};

export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (error instanceof ZodError) {
    return createKnownError("VALIDATION_INVALID_REQUEST", error.flatten());
  }

  if (error instanceof SyntaxError) {
    return createKnownError("VALIDATION_INVALID_REQUEST");
  }

  if (error instanceof Error && isKnownErrorCode(error.message)) {
    return createKnownError(error.message);
  }

  return new AppError({
    code: "SYSTEM_INTERNAL_ERROR",
    message: "Unexpected internal error",
    status: 500,
    category: "system",
  });
}

export function createErrorResponse(error: AppError, requestId: string): ErrorResponseBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
    requestId,
  };
}
