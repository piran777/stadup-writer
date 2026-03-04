import { UserConfig } from "../types";

const WEBHOOK_PREFIX = "https://hooks.slack.com/";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateConfig(config: Partial<UserConfig>): ValidationResult {
  const errors: string[] = [];

  if (config.slackWebhookUrl !== undefined) {
    if (config.slackWebhookUrl && !config.slackWebhookUrl.startsWith(WEBHOOK_PREFIX)) {
      errors.push("Slack webhook URL must start with https://hooks.slack.com/");
    }
  }

  if (config.postingHour !== undefined) {
    if (!Number.isInteger(config.postingHour) || config.postingHour < 0 || config.postingHour > 23) {
      errors.push("Posting hour must be an integer between 0 and 23");
    }
  }

  if (config.timezone !== undefined) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: config.timezone });
    } catch {
      errors.push(`Invalid timezone: ${config.timezone}`);
    }
  }

  if (config.format !== undefined) {
    if (config.format !== "bullets" && config.format !== "prose") {
      errors.push('Format must be "bullets" or "prose"');
    }
  }

  if (config.tone !== undefined) {
    if (config.tone !== "casual" && config.tone !== "professional") {
      errors.push('Tone must be "casual" or "professional"');
    }
  }

  if (config.projects !== undefined && config.projects !== "all") {
    if (!Array.isArray(config.projects)) {
      errors.push('Projects must be an array of project keys or "all"');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isValidWebhookUrl(url: string): boolean {
  return url.startsWith(WEBHOOK_PREFIX) && url.length > WEBHOOK_PREFIX.length;
}
