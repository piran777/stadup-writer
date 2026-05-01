import kvs from "@forge/kvs";
import api from "@forge/api";
import { generateSlackAuthUrl, disconnectSlack } from "../services/slack-oauth";
import { logger } from "../utils/logger";

export async function handleGetSlackAuthUrl(req: any) {
  const accountId: string = req.context.accountId;
  try {
    const url = await generateSlackAuthUrl(accountId);
    return { ok: true, url };
  } catch (error: any) {
    logger.error("Failed to generate Slack auth URL", {
      phase: "slack-oauth",
      accountId,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }
}

export async function handleGetSlackStatus(req: any) {
  const accountId: string = req.context.accountId;
  try {
    const config = (await kvs.get(`config:${accountId}`)) as Record<string, any> | undefined;
    if (!config?.slackConnected || !config?.slackBotToken) {
      return { connected: false, teamName: null, channelName: null, channelId: null };
    }

    return {
      connected: true,
      teamName: config.slackTeamName || null,
      channelId: config.slackChannelId || null,
      channelName: config.slackChannelName || null,
    };
  } catch {
    return { connected: false, teamName: null, channelName: null, channelId: null };
  }
}

export async function handleSetSlackChannel(req: any) {
  const accountId: string = req.context.accountId;
  const channelId: string = req.payload?.channelId;
  const channelName: string | undefined = req.payload?.channelName;

  if (!channelId) {
    return { ok: false, error: "No channel selected" };
  }

  try {
    const existing = (await kvs.get(`config:${accountId}`)) as Record<string, any> | undefined;
    if (!existing?.slackBotToken) {
      return { ok: false, error: "Slack not connected. Please connect first." };
    }

    const updated: Record<string, any> = { ...existing, slackChannelId: channelId };
    if (channelName) {
      updated.slackChannelName = channelName;
    }
    await kvs.set(`config:${accountId}`, updated);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

export async function handleGetSlackChannels(req: any) {
  const accountId: string = req.context.accountId;
  try {
    const config = (await kvs.get(`config:${accountId}`)) as Record<string, any> | undefined;
    if (!config?.slackBotToken) {
      return { ok: false, channels: [], error: "Not connected to Slack" };
    }

    const response = await api.fetch(
      "https://slack.com/api/conversations.list?types=public_channel&exclude_archived=true&limit=200",
      {
        headers: { Authorization: `Bearer ${config.slackBotToken}` },
      }
    );

    if (!response.ok) {
      return { ok: false, channels: [], error: `Slack API error: ${response.status}` };
    }

    const data = await response.json();
    if (!data.ok) {
      return { ok: false, channels: [], error: data.error || "Failed to list channels" };
    }

    const channels = (data.channels || []).map((ch: any) => ({
      id: ch.id,
      name: ch.name,
      isPrivate: ch.is_private || false,
    }));

    return { ok: true, channels };
  } catch (error: any) {
    return { ok: false, channels: [], error: error.message };
  }
}

export async function handleDisconnectSlack(req: any) {
  const accountId: string = req.context.accountId;
  try {
    await disconnectSlack(accountId);
    return { ok: true };
  } catch (error: any) {
    logger.error("Failed to disconnect Slack", {
      phase: "slack-oauth",
      accountId,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }
}
