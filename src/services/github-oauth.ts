import api from "@forge/api";
import kvs from "@forge/kvs";
import { logger } from "../utils/logger";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const OAUTH_SCOPES = "repo read:user";

function getClientId(): string {
  return process.env.GITHUB_CLIENT_ID || "";
}

function getClientSecret(): string {
  return process.env.GITHUB_CLIENT_SECRET || "";
}

export async function generateAuthUrl(accountId: string): Promise<string> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("GITHUB_CLIENT_ID not configured");
  }

  const state = `${accountId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  await kvs.set(`github-oauth-state:${state}`, JSON.stringify({ accountId, expires: Date.now() + 600_000 }));

  const params = new URLSearchParams({
    client_id: clientId,
    scope: OAUTH_SCOPES,
    state,
  });

  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  state: string
): Promise<{ accountId: string; username: string }> {
  const raw = await kvs.get(`github-oauth-state:${state}`) as string | undefined;
  if (!raw) {
    throw new Error("Invalid or expired OAuth state");
  }

  const stateData = JSON.parse(raw);
  if (Date.now() > stateData.expires) {
    await kvs.delete(`github-oauth-state:${state}`);
    throw new Error("OAuth state has expired. Please try connecting again.");
  }

  const accountId = stateData.accountId as string;
  await kvs.delete(`github-oauth-state:${state}`);

  const clientId = getClientId();
  const clientSecret = getClientSecret();

  const response = await api.fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  const accessToken = data.access_token;
  if (!accessToken) {
    throw new Error("No access token in GitHub response");
  }

  const userResponse = await api.fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "auto-standup-bot",
    },
  });

  let username = "";
  if (userResponse.ok) {
    const userData = await userResponse.json();
    username = userData.login || "";
  }

  const existing = (await kvs.get(`config:${accountId}`)) as Record<string, any> | undefined;
  const updated = {
    ...(existing || {}),
    githubToken: accessToken,
    githubUsername: username,
    githubConnected: true,
  };
  await kvs.set(`config:${accountId}`, updated);
  await kvs.setSecret(`github-token:${accountId}`, accessToken);

  logger.info("GitHub OAuth completed", {
    phase: "github-oauth",
    accountId,
    username,
  });

  return { accountId, username };
}

export async function disconnectGitHub(accountId: string): Promise<void> {
  const existing = (await kvs.get(`config:${accountId}`)) as Record<string, any> | undefined;
  if (existing) {
    const updated = { ...existing };
    delete updated.githubToken;
    delete updated.githubUsername;
    updated.githubConnected = false;
    await kvs.set(`config:${accountId}`, updated);
  }
  await kvs.delete(`github-token:${accountId}`);

  logger.info("GitHub disconnected", { phase: "github-oauth", accountId });
}
