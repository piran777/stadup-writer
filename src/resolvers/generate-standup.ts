import kvs from "@forge/kvs";
import { fetchUserActivity } from "../services/jira-activity";
import { fetchGitHubActivity } from "../services/github-activity";
import { generateStandup } from "../services/openai";
import { postToSlack } from "../services/slack";
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
        ? fetchGitHubActivity(config.githubUsername, config.githubToken)
        : Promise.resolve<GitHubActivity>({ commits: [], pullRequests: [] }),
    ]);

    const standup = await generateStandup(
      activity,
      config?.format || "bullets",
      config?.tone || "professional",
      githubActivity
    );

    const fullMessage = truncateSlackMessage(standup);

    let slackResult: { ok: boolean; error?: string } | undefined;

    if (sendToSlack) {
      if (!config?.slackWebhookUrl) {
        slackResult = { ok: false, error: "No Slack webhook URL configured. Go to Settings to add one." };
      } else if (!isValidWebhookUrl(config.slackWebhookUrl)) {
        slackResult = { ok: false, error: "Invalid Slack webhook URL. Check Settings." };
      } else {
        slackResult = await postToSlack(config.slackWebhookUrl, fullMessage);
      }
    }

    const record: StandupRecord = {
      generatedAt: new Date().toISOString(),
      postedToSlack: slackResult?.ok ?? false,
      content: fullMessage,
      activity,
    };

    const dateKey = new Date().toISOString().split("T")[0];
    await kvs.set(`history:${accountId}:${dateKey}`, record);

    logger.standupGenerated(accountId, record.postedToSlack);

    return {
      standup: fullMessage,
      activity,
      slackResult,
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

  if (!editedText.trim()) {
    return { ok: false, error: "Standup text is empty." };
  }

  try {
    const config = (await kvs.get(`config:${accountId}`)) as
      | UserConfig
      | undefined;

    if (!config?.slackWebhookUrl) {
      return { ok: false, error: "No Slack webhook URL configured. Go to Settings to add one." };
    }
    if (!isValidWebhookUrl(config.slackWebhookUrl)) {
      return { ok: false, error: "Invalid Slack webhook URL. Check Settings." };
    }

    const message = truncateSlackMessage(editedText);
    const slackResult = await postToSlack(config.slackWebhookUrl, message);

    if (slackResult.ok) {
      const dateKey = new Date().toISOString().split("T")[0];
      const record: StandupRecord = {
        generatedAt: new Date().toISOString(),
        postedToSlack: true,
        content: message,
        activity: { completed: [], inProgress: [], commented: [], blocked: [] },
      };
      await kvs.set(`history:${accountId}:${dateKey}`, record);
      logger.standupGenerated(accountId, true);
    }

    return slackResult;
  } catch (error: any) {
    logger.error("Send edited standup failed", {
      accountId,
      phase: "slack",
      error: error.message,
    });
    return { ok: false, error: error.message };
  }
}
