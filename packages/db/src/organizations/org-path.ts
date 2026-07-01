const maxLevel = 8;
const bitsPerLevel = 8n;
const segmentMask = 0xffn;
const rootMaxSegment = 127;
const childMaxSegment = 255;

export type OrgPathRange = {
  min: bigint;
  max: bigint;
};

export function encodeOrgPath(segments: number[]): bigint {
  if (segments.length < 1 || segments.length > maxLevel) {
    throw new Error("Organization path must contain 1 to 8 segments");
  }

  validateSegments(segments);

  let path = 0n;
  for (let index = 0; index < maxLevel; index += 1) {
    const segment = BigInt(segments[index] ?? 0);
    const shift = bitsPerLevel * BigInt(maxLevel - index - 1);
    path |= segment << shift;
  }

  return path;
}

export function decodeOrgPath(path: bigint): number[] {
  if (path < 0n) {
    throw new Error("Organization path must be non-negative");
  }

  const segments: number[] = [];
  for (let index = 0; index < maxLevel; index += 1) {
    const shift = bitsPerLevel * BigInt(maxLevel - index - 1);
    const segment = Number((path >> shift) & segmentMask);
    if (segment === 0) {
      break;
    }
    segments.push(segment);
  }

  validateSegments(segments);
  return segments;
}

export function getOrgPathRange(path: bigint, level: number): OrgPathRange {
  if (!Number.isInteger(level) || level < 1 || level > maxLevel) {
    throw new Error("Organization level must be between 1 and 8");
  }

  const segments = decodeOrgPath(path);
  const prefix = segments.slice(0, level);
  if (prefix.length !== level) {
    throw new Error("Organization level does not match path depth");
  }

  const min = encodeOrgPath(prefix);
  const maxSegments = [...prefix];
  while (maxSegments.length < maxLevel) {
    maxSegments.push(childMaxSegment);
  }

  return {
    min,
    max: encodeOrgPath(maxSegments)
  };
}

export function isDescendantPath(candidate: bigint, ancestor: bigint, ancestorLevel: number): boolean {
  const range = getOrgPathRange(ancestor, ancestorLevel);
  return candidate >= range.min && candidate <= range.max && candidate !== ancestor;
}

export function allocateNextOrgSegment(usedSegments: number[], level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > maxLevel) {
    throw new Error("Organization level must be between 1 and 8");
  }

  const maxSegment = level === 1 ? rootMaxSegment : childMaxSegment;
  const used = new Set(usedSegments);

  for (let segment = 1; segment <= maxSegment; segment += 1) {
    if (!used.has(segment)) {
      return segment;
    }
  }

  throw new Error("Organization sibling segment range is exhausted");
}

function validateSegments(segments: number[]): void {
  segments.forEach((segment, index) => {
    const level = index + 1;
    const maxSegment = level === 1 ? rootMaxSegment : childMaxSegment;

    if (!Number.isInteger(segment) || segment < 1 || segment > maxSegment) {
      throw new Error(`Organization path segment at level ${level} must be between 1 and ${maxSegment}`);
    }
  });
}
