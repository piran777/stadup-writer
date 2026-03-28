const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri

export function isPostingTime(
  timezone: string,
  postingHour: number
): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });
    const currentHour = parseInt(formatter.format(now), 10);
    return currentHour === postingHour;
  } catch {
    return false;
  }
}

export function getCurrentDayOfWeek(timezone: string): number {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    }).formatToParts(now);
    const dayStr = parts.find((p) => p.type === "weekday")?.value || "";
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return dayMap[dayStr] ?? new Date().getDay();
  } catch {
    return new Date().getDay();
  }
}

export function isWorkDay(
  timezone: string,
  workDays?: number[],
  skipWeekends?: boolean
): boolean {
  const days = workDays && workDays.length > 0 ? workDays : (skipWeekends ? DEFAULT_WORK_DAYS : [0, 1, 2, 3, 4, 5, 6]);
  const today = getCurrentDayOfWeek(timezone);
  return days.includes(today);
}

export function isWeekday(timezone: string): boolean {
  return isWorkDay(timezone, DEFAULT_WORK_DAYS);
}

export function isLastWorkDayOfWeek(
  timezone: string,
  workDays?: number[],
  skipWeekends?: boolean
): boolean {
  const days = workDays && workDays.length > 0 ? workDays : (skipWeekends ? DEFAULT_WORK_DAYS : [0, 1, 2, 3, 4, 5, 6]);
  const today = getCurrentDayOfWeek(timezone);
  if (!days.includes(today)) return false;

  const sortedDays = [...days].sort((a, b) => a - b);
  const lastDay = sortedDays[sortedDays.length - 1];
  return today === lastDay;
}

export function getWeeklyLookbackHours(
  timezone: string,
  workDays?: number[],
  skipWeekends?: boolean
): number {
  const days = workDays && workDays.length > 0 ? workDays : (skipWeekends ? DEFAULT_WORK_DAYS : [0, 1, 2, 3, 4, 5, 6]);
  const today = getCurrentDayOfWeek(timezone);
  const sortedDays = [...days].sort((a, b) => a - b);
  const firstDay = sortedDays[0];

  let span: number;
  if (today >= firstDay) {
    span = today - firstDay;
  } else {
    span = 7 - firstDay + today;
  }

  return (span + 1) * 24;
}

export function getActivityLookbackHours(
  timezone: string,
  workDays?: number[],
  skipWeekends?: boolean
): number {
  const days = workDays && workDays.length > 0 ? workDays : (skipWeekends ? DEFAULT_WORK_DAYS : [0, 1, 2, 3, 4, 5, 6]);
  const today = getCurrentDayOfWeek(timezone);

  if (!days.includes(today)) {
    return 24;
  }

  let gapDays = 0;
  let checkDay = ((today - 1) + 7) % 7;
  while (!days.includes(checkDay) && gapDays < 7) {
    gapDays++;
    checkDay = ((checkDay - 1) + 7) % 7;
  }

  return (gapDays + 1) * 24;
}
