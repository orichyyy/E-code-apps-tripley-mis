import { jsonParam, nowIso, type DatabaseAdapterExecutor } from "@web-admin-base/adapters";

export function p(executor: DatabaseAdapterExecutor, index: number): string {
  return executor.dialect === "postgresql" ? `$${index}` : "?";
}

export function bool(executor: DatabaseAdapterExecutor, value: boolean): string {
  if (executor.dialect === "postgresql") return value ? "TRUE" : "FALSE";
  return value ? "1" : "0";
}

export function json(executor: DatabaseAdapterExecutor, value: unknown): unknown {
  return jsonParam(value, executor.dialect);
}

export function now(): string {
  return nowIso();
}
