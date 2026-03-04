import { storage, startsWith } from "@forge/api";
import { fetchUserActivity } from "../services/jira-activity";
import { generateStandup } from "../services/openai";
import { postToSlack } from "../services/slack";
import { UserConfig, StandupRecord } from "../types";
import { isPostingTime, isWeekday } from "../utils/time";
import { truncateSlackMessage } from "../utils/format";
import { isValidWebhookUrl } from "../utils/validation";
import { logger } from "../utils/logger";

export async function runHourlyCheck(): Promise<void> {
  logger.info("Scheduler triggered", { phase: "scheduler" });

  let configs: Array<{ accountId: string; config: UserConfig }>;
  try {
    configs = await loadAllUserConfigs();
  } catch (error: any) {
    logger.error("Failed to load user configs", { phase: "scheduler", error: error.message });
    return;
  }

  let processed = 0;
  let skipped = 0;

  for (const { accountId, config } of configs) {
    try {
      const result = await processUser(accountId, config);
      if (result === "processed") processed++;
      else skipped++;
    } catch (error: any) {
      logger.error("Failed to process user", {
        accountId,
        phase: "scheduler",
        error: error.message,
      });
      skipped++;
    }
  }

  logger.schedulerRun(configs.length, processed, skipped);
}

type ProcessResult = "processed" | "skipped";

async function processUser(
  accountId: string,
  config: UserConfig
): Promise<ProcessResult> {
  if (!config.enabled) {
    return "skipped";
  }
  if (!config.slackWebhookUrl || !isValidWebhookUrl(config.slackWebhookUrl)) {
    logger.standupSkipped(accountId, "invalid or missing webhook URL");
    return "skipped";
  }
  if (!isPostingTime(config.timezone, config.postingHour)) {
    return "skipped";
  }
  if (config.skipWeekends && !isWeekday(config.timezone)) {
    logger.standupSkipped(accountId, "weekend");
    return "skipped";
  }

  const activity = await fetchUserActivity(accountId, config.projects);

  const standup = await generateStandup(activity, config.format, config.tone);

  if (standup === "No Jira activity in the last 24 hours.") {
    logger.standupSkipped(accountId, "no activity");
    return "skipped";
  }

  const message = truncateSlackMessage(standup);
  const slackResult = await postToSlack(config.slackWebhookUrl, message);

  const dateKey = new Date().toISOString().split("T")[0];
  const record: StandupRecord = {
    generatedAt: new Date().toISOString(),
    postedToSlack: slackResult.ok,
    content: message,
    activity,
  };

  await storage.set(`history:${accountId}:${dateKey}`, record);

  if (slackResult.ok) {
    logger.standupGenerated(accountId, true);
  } else {
    logger.error("Slack post failed", {
      accountId,
      phase: "slack",
      error: slackResult.error,
    });
  }

  return "processed";
}

async function loadAllUserConfigs(): Promise<
  Array<{ accountId: string; config: UserConfig }>
> {
  const results: Array<{ accountId: string; config: UserConfig }> = [];

  let cursor: string | undefined;

  do {
    let queryBuilder = storage.query().where("key", startsWith("config:")).limit(20);
    if (cursor) {
      queryBuilder = queryBuilder.cursor(cursor);
    }

    const response = await queryBuilder.getMany();

    for (const entry of response.results) {
      const accountId = entry.key.replace("config:", "");
      results.push({ accountId, config: entry.value as UserConfig });
    }

    cursor = response.nextCursor;
  } while (cursor);

  return results;
}
