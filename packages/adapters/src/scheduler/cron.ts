export function computeNextCronRun(cronExpression: string, from = new Date()): string {
  const schedule = parseCronExpression(cronExpression);
  const candidate = new Date(from.getTime() + 60_000);
  candidate.setUTCSeconds(0, 0);
  const deadline = from.getTime() + 366 * 24 * 60 * 60 * 1000;

  while (candidate.getTime() <= deadline) {
    if (matchesSchedule(candidate, schedule)) return candidate.toISOString();
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }

  throw new Error(`Cron expression has no run within one year: ${cronExpression}`);
}

export function isSupportedCronExpression(cronExpression: string): boolean {
  try {
    parseCronExpression(cronExpression);
    return true;
  } catch {
    return false;
  }
}

type CronSchedule = {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
  dayOfMonthWildcard: boolean;
  dayOfWeekWildcard: boolean;
};

function parseCronExpression(cronExpression: string): CronSchedule {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error("Cron expression must use five fields.");
  return {
    minutes: parseField(parts[0] ?? "", 0, 59),
    hours: parseField(parts[1] ?? "", 0, 23),
    daysOfMonth: parseField(parts[2] ?? "", 1, 31),
    months: parseField(parts[3] ?? "", 1, 12),
    daysOfWeek: parseField(parts[4] ?? "", 0, 7, normalizeDayOfWeek),
    dayOfMonthWildcard: parts[2] === "*",
    dayOfWeekWildcard: parts[4] === "*"
  };
}

function parseField(
  field: string,
  min: number,
  max: number,
  normalize: (value: number) => number = (value) => value
): Set<number> {
  const values = new Set<number>();
  for (const token of field.split(",")) {
    addToken(values, token.trim(), min, max, normalize);
  }
  if (values.size === 0) throw new Error("Cron field has no values.");
  return values;
}

function addToken(
  values: Set<number>,
  token: string,
  min: number,
  max: number,
  normalize: (value: number) => number
): void {
  if (!token) throw new Error("Cron field contains an empty token.");
  const [rangeToken, stepToken] = token.split("/");
  const step = stepToken ? Number(stepToken) : 1;
  if (!Number.isInteger(step) || step <= 0) throw new Error("Cron step must be a positive integer.");

  const [start, end] = parseRange(rangeToken ?? "", min, max);
  for (let value = start; value <= end; value += step) {
    values.add(normalize(value));
  }
}

function parseRange(rangeToken: string, min: number, max: number): [number, number] {
  if (rangeToken === "*") return [min, max];
  if (rangeToken.includes("-")) {
    const [start, end] = rangeToken.split("-").map(Number);
    assertInRange(start, min, max);
    assertInRange(end, min, max);
    if (start > end) throw new Error("Cron range start must not exceed range end.");
    return [start, end];
  }
  const value = Number(rangeToken);
  assertInRange(value, min, max);
  return [value, value];
}

function assertInRange(value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Cron value must be an integer from ${min} to ${max}.`);
  }
}

function normalizeDayOfWeek(value: number): number {
  return value === 7 ? 0 : value;
}

function matchesSchedule(date: Date, schedule: CronSchedule): boolean {
  const dayOfMonthMatches = schedule.daysOfMonth.has(date.getUTCDate());
  const dayOfWeekMatches = schedule.daysOfWeek.has(date.getUTCDay());
  return (
    schedule.minutes.has(date.getUTCMinutes()) &&
    schedule.hours.has(date.getUTCHours()) &&
    schedule.months.has(date.getUTCMonth() + 1) &&
    matchesCronDay(schedule, dayOfMonthMatches, dayOfWeekMatches)
  );
}

function matchesCronDay(
  schedule: CronSchedule,
  dayOfMonthMatches: boolean,
  dayOfWeekMatches: boolean
): boolean {
  if (schedule.dayOfMonthWildcard && schedule.dayOfWeekWildcard) return true;
  if (schedule.dayOfMonthWildcard) return dayOfWeekMatches;
  if (schedule.dayOfWeekWildcard) return dayOfMonthMatches;
  return dayOfMonthMatches || dayOfWeekMatches;
}
