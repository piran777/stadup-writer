import api, { webTrigger } from "@forge/api";
import kvs from "@forge/kvs";
import { logger } from "../utils/logger";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const OAUTH_SCOPES = "repo read:user";
const GITHUB_RELAY_PAGE = "https://piran777.github.io/stadup-writer/github-callback.html";

async function getWebtriggerUrl(): Promise<string | undefined> {
  try {
    const url = await webTrigger.getUrl("github-oauth-callback");
    if (url) return url;
  } catch (err: any) {
    logger.warn("webTrigger.getUrl failed for GitHub", { phase: "github-oauth", error: err.message });
  }
  return undefined;
}

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

  const callbackUrl = await getWebtriggerUrl();
  if (!callbackUrl) {
    throw new Error("Could not resolve webtrigger URL for this installation");
  }

  const statePayload = {
    accountId,
    callbackUrl,
    ts: Date.now(),
    nonce: Math.random().toString(36).slice(2),
  };
  const stateToken = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

  logger.info("GitHub OAuth state created", {
    phase: "github-oauth",
    accountId,
    callbackUrl: callbackUrl.slice(-40),
    stateSuffix: stateToken.slice(-8),
  });

  await kvs.set(
    `github-oauth-state:${stateToken}`,
    JSON.stringify({ accountId, expires: Date.now() + 600_000 })
  );

  const params = new URLSearchParams({
    client_id: clientId,
    scope: OAUTH_SCOPES,
    redirect_uri: GITHUB_RELAY_PAGE,
    state: stateToken,
  });

  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  state: string
): Promise<{ accountId: string; username: string }> {
  logger.info("GitHub OAuth callback received", {
    phase: "github-oauth",
    hasCode: !!code,
    stateSuffix: (state || "").slice(-8),
  });

  const raw = (await kvs.get(`github-oauth-state:${state}`)) as string | undefined;
  if (!raw) {
    logger.error("GitHub OAuth state missing in KVS", {
      phase: "github-oauth",
      stateSuffix: (state || "").slice(-8),
    });
    throw new Error(
      "Invalid or expired OAuth state. Please try connecting again."
    );
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

  const tokenBody: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
  };
  tokenBody.redirect_uri = GITHUB_RELAY_PAGE;

  const response = await api.fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(tokenBody),
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
