import { describe, expect, it } from "vitest";

import {
  allocateNextOrgSegment,
  decodeOrgPath,
  encodeOrgPath,
  getOrgPathRange,
  isDescendantPath,
  OrgSegmentRangeExhaustedError
} from "../src";

describe("organization materialized path helpers", () => {
  it("encodes and decodes up to 8 path segments", () => {
    const path = encodeOrgPath([1, 5, 20, 255, 8, 9, 10, 11]);

    expect(decodeOrgPath(path)).toEqual([1, 5, 20, 255, 8, 9, 10, 11]);
  });

  it("restricts the first segment to signed int64 compatible values", () => {
    expect(() => encodeOrgPath([128])).toThrow("level 1 must be between 1 and 127");
  });

  it("returns descendant path ranges using prefix semantics", () => {
    const ancestor = encodeOrgPath([1, 5]);
    const descendant = encodeOrgPath([1, 5, 20]);
    const sibling = encodeOrgPath([1, 6]);

    expect(getOrgPathRange(ancestor, 2)).toEqual({
      min: ancestor,
      max: encodeOrgPath([1, 5, 255, 255, 255, 255, 255, 255])
    });
    expect(isDescendantPath(descendant, ancestor, 2)).toBe(true);
    expect(isDescendantPath(sibling, ancestor, 2)).toBe(false);
  });

  it("allocates the first available sibling segment", () => {
    expect(allocateNextOrgSegment([1, 2, 4], 2)).toBe(3);
  });

  it("throws a typed error when sibling segments are exhausted", () => {
    const usedRootSegments = Array.from({ length: 127 }, (_, index) => index + 1);

    expect(() => allocateNextOrgSegment(usedRootSegments, 1)).toThrow(
      OrgSegmentRangeExhaustedError
    );
  });
});
