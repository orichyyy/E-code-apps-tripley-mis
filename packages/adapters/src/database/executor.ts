export type DatabaseDialect = "postgresql" | "sqlite";

export type DatabaseRow = Record<string, unknown>;

export type DatabaseAdapterExecutor = {
  readonly dialect: DatabaseDialect;
  all: (sql: string, params?: unknown[]) => Promise<DatabaseRow[]>;
  run: (sql: string, params?: unknown[]) => Promise<void>;
  transaction: <T>(operation: () => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

export function placeholders(count: number, dialect: DatabaseDialect): string {
  return Array.from({ length: count }, (_, index) =>
    dialect === "postgresql" ? `$${index + 1}` : "?",
  ).join(", ");
}

export function param(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

export function jsonParam(value: unknown, dialect: DatabaseDialect): unknown {
  if (dialect === "sqlite") return JSON.stringify(value);
  if (Array.isArray(value) || typeof value === "string") return JSON.stringify(value);
  return value;
}

export function readJson<T>(value: unknown): T {
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addSecondsIso(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}
