export function nowUtc(): Date {
  return new Date();
}

export function toUtcIso(date: Date): string {
  return date.toISOString();
}

export function addDaysUtc(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function addSecondsUtc(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
