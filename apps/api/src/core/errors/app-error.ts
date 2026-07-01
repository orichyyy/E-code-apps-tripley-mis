export type ErrorCategory =
  | "authentication"
  | "authorization"
  | "business"
  | "system"
  | "validation";

export type AppErrorOptions = {
  code: string;
  message: string;
  status: number;
  category: ErrorCategory;
  details?: unknown;
};

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly category: ErrorCategory;
  readonly details?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status;
    this.category = options.category;
    this.details = options.details;
  }
}

export function appError(options: AppErrorOptions): AppError {
  return new AppError(options);
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
