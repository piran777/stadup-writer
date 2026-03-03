import { storage } from "@forge/api";
import { fetchUserActivity } from "../services/jira-activity";
import { generateStandup } from "../services/openai";
import { postToSlack } from "../services/slack";
import { UserConfig, StandupRecord } from "../types";
import { truncateSlackMessage, formatStandupHeader } from "../utils/format";

export async function handleGenerateStandup(req: any) {
  const accountId: string = req.context.accountId;
  const sendToSlack: boolean = req.payload?.sendToSlack ?? false;

  const config = (await storage.get(`config:${accountId}`)) as UserConfig | undefined;

  const activity = await fetchUserActivity(
    accountId,
    config?.projects
  );

  const standup = await generateStandup(
    activity,
    config?.format || "bullets",
    config?.tone || "professional"
  );

  const fullMessage = truncateSlackMessage(standup);

  let slackResult: { ok: boolean; error?: string } = { ok: false, error: "Not sent" };
  if (sendToSlack && config?.slackWebhookUrl) {
    slackResult = await postToSlack(config.slackWebhookUrl, fullMessage);
  }

  const record: StandupRecord = {
    generatedAt: new Date().toISOString(),
    postedToSlack: slackResult.ok,
    content: fullMessage,
    activity,
  };

  const dateKey = new Date().toISOString().split("T")[0];
  await storage.set(`history:${accountId}:${dateKey}`, record);

  return {
    standup: fullMessage,
    activity,
    slackResult: sendToSlack ? slackResult : undefined,
  };
}
