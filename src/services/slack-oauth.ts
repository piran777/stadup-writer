import api from "@forge/api";
import kvs from "@forge/kvs";
import { logger } from "../utils/logger";

const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
const BOT_SCOPES = "chat:write,chat:write.public,channels:read";

function getRedirectUri(): string | undefined {
  const u = process.env.SLACK_REDIRECT_URI?.trim();
  return u || undefined;
}

function getClientId(): string {
  return process.env.SLACK_CLIENT_ID || "";
}

function getClientSecret(): string {
  return process.env.SLACK_CLIENT_SECRET || "";
}

export async function generateSlackAuthUrl(accountId: string): Promise<string> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("SLACK_CLIENT_ID not configured");
  }

  const state = `${accountId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const redirectUri = getRedirectUri();

  logger.info("Slack OAuth state created", {
    phase: "slack-oauth",
    accountId,
    hasRedirectUri: !!redirectUri,
    stateSuffix: state.slice(-8),
  });

  await kvs.set(
    `slack-oauth-state:${state}`,
    JSON.stringify({ accountId, expires: Date.now() + 600_000 })
  );

  const params = new URLSearchParams({
    client_id: clientId,
    scope: BOT_SCOPES,
    state,
  });

  if (redirectUri) {
    params.set("redirect_uri", redirectUri);
  }

  return `${SLACK_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeSlackCodeForToken(
  code: string,
  state: string
): Promise<{ accountId: string; teamName: string; channelId?: string; channelName?: string }> {
  logger.info("Slack OAuth callback received", {
    phase: "slack-oauth",
    hasCode: !!code,
    stateSuffix: (state || "").slice(-8),
  });

  const raw = (await kvs.get(`slack-oauth-state:${state}`)) as string | undefined;
  if (!raw) {
    logger.error("Slack OAuth state missing in KVS", {
      phase: "slack-oauth",
      stateSuffix: (state || "").slice(-8),
    });
    throw new Error(
      "Invalid or expired OAuth state. Check that SLACK_REDIRECT_URI matches this environment's webtrigger URL."
    );
  }

  const stateData = JSON.parse(raw);
  if (Date.now() > stateData.expires) {
    await kvs.delete(`slack-oauth-state:${state}`);
    throw new Error("OAuth state has expired. Please try connecting again.");
  }

  const accountId = stateData.accountId as string;
  await kvs.delete(`slack-oauth-state:${state}`);

  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const redirectUri = getRedirectUri();

  const tokenBody: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
  };
  if (redirectUri) {
    tokenBody.redirect_uri = redirectUri;
  }

  const response = await api.fetch(SLACK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(tokenBody).toString(),
  });

  if (!response.ok) {
    throw new Error(`Slack token exchange failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error || "unknown error"}`);
  }

  const botToken = data.access_token;
  if (!botToken) {
    throw new Error("No access token in Slack response");
  }

  const teamName = data.team?.name || "Slack Workspace";
  const channelId = data.incoming_webhook?.channel_id;
  const channelName = data.incoming_webhook?.channel;

  const existing = (await kvs.get(`config:${accountId}`)) as Record<string, any> | undefined;
  const updated = {
    ...(existing || {}),
    slackBotToken: botToken,
    slackTeamName: teamName,
    slackConnected: true,
    ...(channelId ? { slackChannelId: channelId } : {}),
  };
  await kvs.set(`config:${accountId}`, updated);
  await kvs.setSecret(`slack-token:${accountId}`, botToken);

  logger.info("Slack OAuth completed", {
    phase: "slack-oauth",
    accountId,
    teamName,
    hasChannel: !!channelId,
  });

  return { accountId, teamName, channelId, channelName };
}

export async function disconnectSlack(accountId: string): Promise<void> {
  const existing = (await kvs.get(`config:${accountId}`)) as Record<string, any> | undefined;
  if (existing) {
    const updated = { ...existing };
    delete updated.slackBotToken;
    delete updated.slackChannelId;
    delete updated.slackTeamName;
    updated.slackConnected = false;
    await kvs.set(`config:${accountId}`, updated);
  }
  await kvs.delete(`slack-token:${accountId}`);

  logger.info("Slack disconnected", { phase: "slack-oauth", accountId });
}
