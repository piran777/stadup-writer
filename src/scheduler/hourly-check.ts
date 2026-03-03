import { storage, startsWith } from "@forge/api";
import { fetchUserActivity } from "../services/jira-activity";
import { generateStandup } from "../services/openai";
import { postToSlack } from "../services/slack";
import { UserConfig, StandupRecord } from "../types";
import { isPostingTime, isWeekday } from "../utils/time";
import { truncateSlackMessage } from "../utils/format";

export async function runHourlyCheck(): Promise<void> {
  const configs = await loadAllUserConfigs();

  for (const { accountId, config } of configs) {
    try {
      await processUser(accountId, config);
    } catch (error) {
      console.error(`Failed to process user ${accountId}:`, error);
    }
  }
}

async function processUser(
  accountId: string,
  config: UserConfig
): Promise<void> {
  if (!config.enabled) return;
  if (!config.slackWebhookUrl) return;
  if (!isPostingTime(config.timezone, config.postingHour)) return;
  if (config.skipWeekends && !isWeekday(config.timezone)) return;

  const activity = await fetchUserActivity(accountId, config.projects);

  const standup = await generateStandup(activity, config.format, config.tone);

  if (standup === "No Jira activity in the last 24 hours.") {
    return;
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

  if (!slackResult.ok) {
    console.error(
      `Slack post failed for ${accountId}: ${slackResult.error}`
    );
  }
}

async function loadAllUserConfigs(): Promise<
  Array<{ accountId: string; config: UserConfig }>
> {
  const results: Array<{ accountId: string; config: UserConfig }> = [];

  const query = storage.query().where("key", startsWith("config:"));
  const { results: entries } = await query.getMany();

  for (const entry of entries) {
    const accountId = entry.key.replace("config:", "");
    results.push({ accountId, config: entry.value as UserConfig });
  }

  return results;
}
