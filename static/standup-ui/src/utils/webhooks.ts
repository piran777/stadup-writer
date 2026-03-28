const SLACK_PREFIX = "https://hooks.slack.com/";

const TEAMS_MARKERS = [
  ".webhook.office.com",
  "outlook.office.com/webhook",
  "outlook.office365.com/webhook",
];

export function isValidSlackWebhookUrl(url: string): boolean {
  return Boolean(url && url.startsWith(SLACK_PREFIX) && url.length > SLACK_PREFIX.length);
}

export function isValidTeamsWebhookUrl(url: string): boolean {
  if (!url || !url.startsWith("https://")) return false;
  return TEAMS_MARKERS.some((m) => url.includes(m));
}
