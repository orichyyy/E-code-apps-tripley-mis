import type { Context, MiddlewareHandler, Next } from "hono";

export type StructuredLogLevel = "debug" | "info" | "warn" | "error";

export type StructuredLogEntry = {
  level: StructuredLogLevel;
  event: string;
  requestId: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type StructuredLogSink = {
  write(entry: StructuredLogEntry): void | Promise<void>;
};

export const noopStructuredLogSink: StructuredLogSink = {
  write() {
    // Default local/test sink keeps logging structured without forcing console output.
  }
};

export function createStructuredLoggingMiddleware(
  sink: StructuredLogSink = noopStructuredLogSink
): MiddlewareHandler {
  return async (context: Context, next: Next) => {
    const startedAt = Date.now();
    await next();

    await sink.write({
      level: context.res.status >= 500 ? "error" : "info",
      event: "http_request",
      requestId: context.get("requestId"),
      method: context.req.method,
      path: context.req.path,
      status: context.res.status,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString()
    });
  };
}
