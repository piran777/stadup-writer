import Resolver from "@forge/resolver";
import { handleGenerateStandup, handleSendEditedStandup } from "./resolvers/generate-standup";
import { handleGetSettings, handleSaveSettings, handleTestWebhook, handleTestTeamsWebhook } from "./resolvers/settings";
import { handleGetHistory } from "./resolvers/history";
import {
  handleGetGitHubAuthUrl,
  handleGetGitHubStatus,
  handleDisconnectGitHub,
} from "./resolvers/github-auth";
import { runHourlyCheck } from "./scheduler/hourly-check";
import { exchangeCodeForToken } from "./services/github-oauth";
import { logger } from "./utils/logger";

const resolver = new Resolver();

resolver.define("generateStandup", handleGenerateStandup);
resolver.define("getSettings", handleGetSettings);
resolver.define("saveSettings", handleSaveSettings);
resolver.define("getHistory", handleGetHistory);
resolver.define("testWebhook", handleTestWebhook);
resolver.define("testTeamsWebhook", handleTestTeamsWebhook);
resolver.define("sendEditedStandup", handleSendEditedStandup);
resolver.define("getGitHubAuthUrl", handleGetGitHubAuthUrl);
resolver.define("getGitHubStatus", handleGetGitHubStatus);
resolver.define("disconnectGitHub", handleDisconnectGitHub);

export const handler = resolver.getDefinitions();

export const scheduledHandler = async () => {
  await runHourlyCheck();
};

export const githubOAuthCallback = async (req: any) => {
  try {
    const params = new URLSearchParams(req.queryParameters || {});
    let code = params.get("code") || req.queryParameters?.code;
    let state = params.get("state") || req.queryParameters?.state;

    if (Array.isArray(code)) code = code[0];
    if (Array.isArray(state)) state = state[0];

    if (!code || !state) {
      return {
        statusCode: 400,
        headers: { "Content-Type": ["text/html"] },
        body: errorPage("Missing authorization code. Please try connecting again."),
      };
    }

    const { username } = await exchangeCodeForToken(code, state);

    return {
      statusCode: 200,
      headers: { "Content-Type": ["text/html"] },
      body: successPage(username),
    };
  } catch (error: any) {
    logger.error("GitHub OAuth callback failed", {
      phase: "github-oauth",
      error: error.message,
    });
    return {
      statusCode: 200,
      headers: { "Content-Type": ["text/html"] },
      body: errorPage(error.message),
    };
  }
};

function successPage(username: string): string {
  return `<!DOCTYPE html>
<html><head><title>GitHub Connected</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f4f5f7}
.card{background:#fff;border-radius:12px;padding:40px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.1);max-width:400px}
h2{color:#36B37E;margin:0 0 8px} p{color:#6B778C;margin:0 0 16px}
.username{background:#DEEBFF;color:#0052CC;padding:4px 12px;border-radius:4px;font-weight:600;display:inline-block}</style></head>
<body><div class="card"><h2>GitHub Connected!</h2>
<p>Signed in as <span class="username">${username}</span></p>
<p>You can close this window and return to Jira.</p>
<script>setTimeout(()=>window.close(),3000)</script></div></body></html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html><head><title>Connection Failed</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f4f5f7}
.card{background:#fff;border-radius:12px;padding:40px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.1);max-width:400px}
h2{color:#DE350B;margin:0 0 8px} p{color:#6B778C;margin:0 0 16px}</style></head>
<body><div class="card"><h2>Connection Failed</h2>
<p>${message}</p>
<p>Please close this window and try again.</p></div></body></html>`;
}
