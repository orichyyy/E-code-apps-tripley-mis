import { createKnownError } from "../../core/errors/error-codes";

export async function readOptionalJson<T>(request: Request): Promise<T | null> {
  if (!request.body) return null;
  const text = await request.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as T;
}

export async function assertEmptyJsonBody(request: Request): Promise<void> {
  const body = await readOptionalJson<unknown>(request);
  if (body === null) return;
  if (!isPlainEmptyObject(body)) throw createKnownError("VALIDATION_INVALID_REQUEST");
}

function isPlainEmptyObject(value: unknown): value is Record<string, never> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}
