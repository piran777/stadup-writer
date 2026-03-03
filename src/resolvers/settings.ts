import { storage } from "@forge/api";
import { UserConfig } from "../types";
import { testSlackWebhook } from "../services/slack";

const DEFAULT_CONFIG: UserConfig = {
  enabled: false,
  slackWebhookUrl: "",
  timezone: "America/New_York",
  postingHour: 9,
  skipWeekends: true,
  projects: "all",
  format: "bullets",
  tone: "professional",
};

export async function handleGetSettings(req: any) {
  const accountId: string = req.context.accountId;
  const config = await storage.get(`config:${accountId}`);
  return config || DEFAULT_CONFIG;
}

export async function handleSaveSettings(req: any) {
  const accountId: string = req.context.accountId;
  const updates: Partial<UserConfig> = req.payload;

  const existing =
    ((await storage.get(`config:${accountId}`)) as UserConfig) || DEFAULT_CONFIG;

  const merged: UserConfig = { ...existing, ...updates };

  await storage.set(`config:${accountId}`, merged);

  if (updates.slackWebhookUrl && updates.slackWebhookUrl !== existing.slackWebhookUrl) {
    await storage.setSecret(`webhook:${accountId}`, updates.slackWebhookUrl);
  }

  return { success: true, config: merged };
}

export async function handleTestWebhook(req: any) {
  const webhookUrl: string = req.payload?.webhookUrl;
  if (!webhookUrl) {
    return { ok: false, error: "No webhook URL provided" };
  }
  return testSlackWebhook(webhookUrl);
}
