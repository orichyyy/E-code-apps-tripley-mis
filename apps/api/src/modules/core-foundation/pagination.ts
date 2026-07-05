import { createKnownError } from "../../core/errors/error-codes";

export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function pageItems<T>(
  items: T[],
  query: { page?: string; pageSize?: string },
): PageResult<T> {
  const page = parsePositiveInteger(query.page ?? "1");
  const pageSize = parsePositiveInteger(query.pageSize ?? "20");
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    page,
    pageSize,
    total: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

function parsePositiveInteger(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) throw createKnownError("VALIDATION_INVALID_REQUEST");
  return Number(value);
}
