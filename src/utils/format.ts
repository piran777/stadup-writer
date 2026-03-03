export function truncateSlackMessage(
  message: string,
  maxLength: number = 3000
): string {
  if (message.length <= maxLength) return message;
  return message.slice(0, maxLength - 3) + "...";
}

export function formatStandupHeader(displayName: string): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return `*Daily Standup - ${displayName}* (${today})\n\n`;
}
