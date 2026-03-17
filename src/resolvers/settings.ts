import kvs from "@forge/kvs";
import { UserConfig } from "../types";
import { testSlackWebhook } from "../services/slack";
import { validateConfig, isValidWebhookUrl } from "../utils/validation";
import { logger } from "../utils/logger";

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
  try {
    const config = await kvs.get(`config:${accountId}`);
    return config || DEFAULT_CONFIG;
  } catch (error: any) {
    logger.error("Failed to load settings", { accountId, error: error.message });
    return DEFAULT_CONFIG;
  }
}

export async function handleSaveSettings(req: any) {
  const accountId: string = req.context.accountId;
  const updates: Partial<UserConfig> = req.payload;

  const validation = validateConfig(updates);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  try {
    const existing =
      ((await kvs.get(`config:${accountId}`)) as UserConfig) || DEFAULT_CONFIG;

    const merged: UserConfig = { ...existing, ...updates };

    await kvs.set(`config:${accountId}`, merged);

    if (updates.slackWebhookUrl && updates.slackWebhookUrl !== existing.slackWebhookUrl) {
      await kvs.setSecret(`webhook:${accountId}`, updates.slackWebhookUrl);
    }

    logger.info("Settings saved", { accountId });
    return { success: true, config: merged };
  } catch (error: any) {
    logger.error("Failed to save settings", { accountId, error: error.message });
    return { success: false, errors: ["Failed to save settings. Please try again."] };
  }
}

export async function handleTestWebhook(req: any) {
  const webhookUrl: string = req.payload?.webhookUrl;
  if (!webhookUrl) {
    return { ok: false, error: "No webhook URL provided" };
  }
  if (!isValidWebhookUrl(webhookUrl)) {
    return { ok: false, error: "Invalid Slack webhook URL format" };
  }
  return testSlackWebhook(webhookUrl);
}
