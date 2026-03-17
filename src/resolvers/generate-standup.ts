import kvs from "@forge/kvs";
import { fetchUserActivity } from "../services/jira-activity";
import { generateStandup } from "../services/openai";
import { postToSlack } from "../services/slack";
import { UserConfig, StandupRecord } from "../types";
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

    const activity = await fetchUserActivity(accountId, config?.projects);

    const standup = await generateStandup(
      activity,
      config?.format || "bullets",
      config?.tone || "professional"
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
