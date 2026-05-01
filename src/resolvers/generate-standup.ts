import kvs from "@forge/kvs";
import { fetchUserActivity } from "../services/jira-activity";
import { fetchGitHubActivity } from "../services/github-activity";
import { fetchUserDisplayName } from "../services/jira-user";
import { generateStandup } from "../services/openai";
import { postToSlack } from "../services/slack";
import { postToTeams, isValidTeamsWebhookUrl } from "../services/teams";
import { UserConfig, StandupRecord, GitHubActivity } from "../types";
import { truncateSlackMessage } from "../utils/format";
import { isValidWebhookUrl } from "../utils/validation";
import { isLastWorkDayOfWeek, getWeeklyLookbackHours } from "../utils/time";
import { logger } from "../utils/logger";

export async function handleGenerateStandup(req: any) {
  const accountId: string = req.context.accountId;
  const sendToSlack: boolean = req.payload?.sendToSlack ?? false;

  try {
    const config = (await kvs.get(`config:${accountId}`)) as
      | UserConfig
      | undefined;

    const isWeeklyDigest = !!(
      config?.weeklyDigest &&
      isLastWorkDayOfWeek(config.timezone || "America/New_York", config.workDays, config.skipWeekends)
    );
    const lookbackHours = isWeeklyDigest
      ? getWeeklyLookbackHours(config!.timezone || "America/New_York", config!.workDays, config!.skipWeekends)
      : undefined;

    const hasGitHub = !!(config?.githubUsername && config?.githubToken);
    logger.info("GitHub config check", {
      phase: "generate",
      accountId,
      hasGitHub,
      isWeeklyDigest,
      lookbackHours,
      githubUsername: config?.githubUsername || "none",
      hasToken: !!config?.githubToken,
      orgs: config?.githubOrgs || [],
      orgOnly: config?.githubOrgOnly ?? false,
    });

    const [activity, githubActivity, displayName] = await Promise.all([
      fetchUserActivity(accountId, config?.projects, lookbackHours),
      hasGitHub
        ? fetchGitHubActivity(config!.githubUsername!, config!.githubToken!, {
            orgs: config!.githubOrgs,
            orgOnly: config!.githubOrgOnly,
          }, lookbackHours)
        : Promise.resolve<GitHubActivity>({ commits: [], pullRequests: [] }),
      fetchUserDisplayName(accountId),
    ]);

    const standup = await generateStandup(
      activity,
      config?.format || "bullets",
      config?.tone || "professional",
      githubActivity,
      { isWeeklyDigest, customPrompt: config?.customPrompt }
    );

    const fullMessage = truncateSlackMessage(standup);

    let slackResult: { ok: boolean; error?: string } | undefined;
    let teamsResult: { ok: boolean; error?: string } | undefined;

    if (sendToSlack) {
      const hasSlackWebhook = config?.slackWebhookUrl && isValidWebhookUrl(config.slackWebhookUrl);
      const hasSlackOAuth = !!(config?.slackBotToken && config?.slackChannelId);
      const hasSlack = hasSlackWebhook || hasSlackOAuth;
      const hasTeams = config?.teamsWebhookUrl && isValidTeamsWebhookUrl(config.teamsWebhookUrl);

      if (!hasSlack && !hasTeams) {
        slackResult = { ok: false, error: "No Slack or Teams connection configured. Go to Settings." };
      } else {
        if (hasSlack) {
          slackResult = await postToSlack(config!.slackWebhookUrl, fullMessage, {
            displayName,
            botToken: config!.slackBotToken,
            channelId: config!.slackChannelId,
          });
        }
        if (hasTeams) {
          teamsResult = await postToTeams(config!.teamsWebhookUrl!, fullMessage, { displayName });
        }
      }
    }

    const posted = slackResult?.ok || teamsResult?.ok || false;

    const record: StandupRecord = {
      generatedAt: new Date().toISOString(),
      postedToSlack: posted,
      content: fullMessage,
      activity,
    };

    const dateKey = new Date().toISOString().split("T")[0];
    await kvs.set(`history:${accountId}:${dateKey}`, record);

    logger.standupGenerated(accountId, posted);

    return {
      standup: fullMessage,
      displayName,
      activity,
      slackResult,
      teamsResult,
    };
  } catch (error: any) {
    logger.error("Generate standup failed", {
      accountId,
      phase: "generate",
      error: error.message,
    });
    return {
      standup: "Something went wrong generating your standup. Please try again.",
      activity: null,
      slackResult: sendToSlack
        ? { ok: false, error: "Generation failed" }
        : undefined,
    };
  }
}

export async function handleSendEditedStandup(req: any) {
  const accountId: string = req.context.accountId;
  const editedText: string = req.payload?.text ?? "";
  const target: string = req.payload?.target ?? "all";

  if (!editedText.trim()) {
    return { ok: false, error: "Standup text is empty." };
  }

  try {
    const [config, displayName] = await Promise.all([
      kvs.get(`config:${accountId}`) as Promise<UserConfig | undefined>,
      fetchUserDisplayName(accountId),
    ]);

    const message = truncateSlackMessage(editedText);
    const results: { slack?: { ok: boolean; error?: string }; teams?: { ok: boolean; error?: string } } = {};

    const hasSlackWebhook = config?.slackWebhookUrl && isValidWebhookUrl(config.slackWebhookUrl);
    const hasSlackOAuth = !!(config?.slackBotToken && config?.slackChannelId);
    if ((target === "all" || target === "slack") && (hasSlackWebhook || hasSlackOAuth)) {
      results.slack = await postToSlack(config!.slackWebhookUrl, message, {
        displayName,
        botToken: config!.slackBotToken,
        channelId: config!.slackChannelId,
      });
    }

    if ((target === "all" || target === "teams") && config?.teamsWebhookUrl && isValidTeamsWebhookUrl(config.teamsWebhookUrl)) {
      results.teams = await postToTeams(config.teamsWebhookUrl, message, { displayName });
    }

    if (!results.slack && !results.teams) {
      return { ok: false, error: "No webhook URLs configured. Go to Settings to add Slack or Teams." };
    }

    const anyOk = results.slack?.ok || results.teams?.ok;

    if (anyOk) {
      const dateKey = new Date().toISOString().split("T")[0];
      const record: StandupRecord = {
        generatedAt: new Date().toISOString(),
        postedToSlack: anyOk,
        content: message,
        activity: { completed: [], inProgress: [], commented: [], blocked: [] },
      };
      await kvs.set(`history:${accountId}:${dateKey}`, record);
      logger.standupGenerated(accountId, true);
    }

    const errors = [
      results.slack && !results.slack.ok ? `Slack: ${results.slack.error}` : "",
      results.teams && !results.teams.ok ? `Teams: ${results.teams.error}` : "",
    ].filter(Boolean).join("; ");

    return { ok: !!anyOk, error: errors || undefined, results };
  } catch (error: any) {
    logger.error("Send edited standup failed", {
      accountId,
      phase: "messaging",
      error: error.message,
    });
    return { ok: false, error: error.message };
  }
}
