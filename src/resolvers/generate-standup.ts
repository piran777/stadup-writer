import kvs from "@forge/kvs";
import { fetchUserActivity } from "../services/jira-activity";
import { fetchGitHubActivity } from "../services/github-activity";
import { generateStandup } from "../services/openai";
import { postToSlack } from "../services/slack";
import { postToTeams, isValidTeamsWebhookUrl } from "../services/teams";
import { UserConfig, StandupRecord, GitHubActivity } from "../types";
import { truncateSlackMessage } from "../utils/format";
import { isValidWebhookUrl } from "../utils/validation";
import { logger } from "../utils/logger";

export async function handleGenerateStandup(req: any) {
  const accountId: string = req.context.accountId;
  const sendToSlack: boolean = req.payload?.sendToSlack ?? false;

  try {
    const config = (await kvs.get(`config:${accountId}`)) as
      | UserConfig
      | undefined;

    const [activity, githubActivity] = await Promise.all([
      fetchUserActivity(accountId, config?.projects),
      config?.githubUsername && config?.githubToken
        ? fetchGitHubActivity(config.githubUsername, config.githubToken, {
            orgs: config.githubOrgs,
            orgOnly: config.githubOrgOnly,
          })
        : Promise.resolve<GitHubActivity>({ commits: [], pullRequests: [] }),
    ]);

    const standup = await generateStandup(
      activity,
      config?.format || "bullets",
      config?.tone || "professional",
      githubActivity,
      { customPrompt: config?.customPrompt }
    );

    const fullMessage = truncateSlackMessage(standup);

    let slackResult: { ok: boolean; error?: string } | undefined;
    let teamsResult: { ok: boolean; error?: string } | undefined;

    if (sendToSlack) {
      const hasSlack = config?.slackWebhookUrl && isValidWebhookUrl(config.slackWebhookUrl);
      const hasTeams = config?.teamsWebhookUrl && isValidTeamsWebhookUrl(config.teamsWebhookUrl);

      if (!hasSlack && !hasTeams) {
        slackResult = { ok: false, error: "No webhook URLs configured. Go to Settings to add Slack or Teams." };
      } else {
        if (hasSlack) {
          slackResult = await postToSlack(config!.slackWebhookUrl, fullMessage);
        }
        if (hasTeams) {
          teamsResult = await postToTeams(config!.teamsWebhookUrl!, fullMessage);
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
    const config = (await kvs.get(`config:${accountId}`)) as
      | UserConfig
      | undefined;

    const message = truncateSlackMessage(editedText);
    const results: { slack?: { ok: boolean; error?: string }; teams?: { ok: boolean; error?: string } } = {};

    if ((target === "all" || target === "slack") && config?.slackWebhookUrl && isValidWebhookUrl(config.slackWebhookUrl)) {
      results.slack = await postToSlack(config.slackWebhookUrl, message);
    }

    if ((target === "all" || target === "teams") && config?.teamsWebhookUrl && isValidTeamsWebhookUrl(config.teamsWebhookUrl)) {
      results.teams = await postToTeams(config.teamsWebhookUrl, message);
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
