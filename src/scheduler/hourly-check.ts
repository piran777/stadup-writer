import kvs, { WhereConditions } from "@forge/kvs";
import { fetchUserActivity } from "../services/jira-activity";
import { fetchGitHubActivity } from "../services/github-activity";
import { fetchUserDisplayName } from "../services/jira-user";
import { generateStandup } from "../services/openai";
import { postToSlack } from "../services/slack";
import { postToTeams, isValidTeamsWebhookUrl } from "../services/teams";
import { UserConfig, StandupRecord, GitHubActivity } from "../types";
import { isPostingTime, isWorkDay, getActivityLookbackHours, isLastWorkDayOfWeek, getWeeklyLookbackHours } from "../utils/time";
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
  const hasSlack = config.slackWebhookUrl && isValidWebhookUrl(config.slackWebhookUrl);
  const hasTeams = config.teamsWebhookUrl && isValidTeamsWebhookUrl(config.teamsWebhookUrl);
  if (!hasSlack && !hasTeams) {
    logger.standupSkipped(accountId, "no valid webhook URLs");
    return "skipped";
  }
  if (!isPostingTime(config.timezone, config.postingHour)) {
    return "skipped";
  }
  if (!isWorkDay(config.timezone, config.workDays, config.skipWeekends)) {
    logger.standupSkipped(accountId, "not a work day");
    return "skipped";
  }

  const dateKey = new Date().toISOString().split("T")[0];
  const existing = await kvs.get(`history:${accountId}:${dateKey}`) as StandupRecord | undefined;
  if (existing?.postedToSlack) {
    logger.standupSkipped(accountId, "already posted today");
    return "skipped";
  }

  const useWeeklyDigest = config.weeklyDigest && isLastWorkDayOfWeek(config.timezone, config.workDays, config.skipWeekends);
  const lookbackHours = useWeeklyDigest
    ? getWeeklyLookbackHours(config.timezone, config.workDays, config.skipWeekends)
    : getActivityLookbackHours(config.timezone, config.workDays, config.skipWeekends);

  const [activity, githubActivity, displayName] = await Promise.all([
    fetchUserActivity(accountId, config.projects, lookbackHours),
    config.githubUsername && config.githubToken
      ? fetchGitHubActivity(config.githubUsername, config.githubToken, {
          orgs: config.githubOrgs,
          orgOnly: config.githubOrgOnly,
        }, lookbackHours)
      : Promise.resolve<GitHubActivity>({ commits: [], pullRequests: [] }),
    fetchUserDisplayName(accountId),
  ]);

  const standup = await generateStandup(
    activity, config.format, config.tone, githubActivity,
    { isWeeklyDigest: useWeeklyDigest, customPrompt: config.customPrompt }
  );

  if (standup === "No Jira activity in the last 24 hours." || standup === "No activity this week.") {
    logger.standupSkipped(accountId, "no activity");
    return "skipped";
  }

  const message = truncateSlackMessage(standup);

  let slackOk = false;
  let teamsOk = false;

  if (hasSlack) {
    const slackResult = await postToSlack(config.slackWebhookUrl, message, { displayName });
    slackOk = slackResult.ok;
    if (!slackOk) {
      logger.error("Slack post failed", { accountId, phase: "slack", error: slackResult.error });
    }
  }

  if (hasTeams) {
    const teamsResult = await postToTeams(config.teamsWebhookUrl!, message, { displayName });
    teamsOk = teamsResult.ok;
    if (!teamsOk) {
      logger.error("Teams post failed", { accountId, phase: "teams", error: teamsResult.error });
    }
  }

  const posted = slackOk || teamsOk;

  const record: StandupRecord = {
    generatedAt: new Date().toISOString(),
    postedToSlack: posted,
    content: message,
    activity,
  };

  await kvs.set(`history:${accountId}:${dateKey}`, record);

  if (posted) {
    logger.standupGenerated(accountId, true);
  }

  return "processed";
}

async function loadAllUserConfigs(): Promise<
  Array<{ accountId: string; config: UserConfig }>
> {
  const results: Array<{ accountId: string; config: UserConfig }> = [];

  let cursor: string | undefined;

  do {
    let queryBuilder = kvs.query().where("key", WhereConditions.beginsWith("config:")).limit(20);
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
