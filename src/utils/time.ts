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

export function isWeekday(timezone: string): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    });
    const day = formatter.format(now);
    return day !== "Sat" && day !== "Sun";
  } catch {
    return true;
  }
}
