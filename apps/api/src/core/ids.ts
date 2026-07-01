import { z } from "zod";

export const integerIdSchema = z.string().regex(/^[1-9]\d*$/, "Expected an integer ID string");

export function serializeId(id: number | bigint): string {
  return id.toString();
}

export function parseIntegerId(id: string): number {
  const value = integerIdSchema.parse(id);
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    throw new Error("Integer ID is outside the safe JavaScript number range");
  }

  return parsed;
}
