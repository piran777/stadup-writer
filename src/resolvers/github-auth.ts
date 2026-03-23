import kvs from "@forge/kvs";
import { generateAuthUrl, disconnectGitHub } from "../services/github-oauth";
import { logger } from "../utils/logger";

export async function handleGetGitHubAuthUrl(req: any) {
  const accountId: string = req.context.accountId;
  try {
    const url = await generateAuthUrl(accountId);
    return { ok: true, url };
  } catch (error: any) {
    logger.error("Failed to generate GitHub auth URL", {
      phase: "github-oauth",
      accountId,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }
}

export async function handleGetGitHubStatus(req: any) {
  const accountId: string = req.context.accountId;
  try {
    const config = (await kvs.get(`config:${accountId}`)) as Record<string, any> | undefined;
    return {
      connected: !!(config?.githubConnected && config?.githubUsername),
      username: config?.githubUsername || null,
    };
  } catch {
    return { connected: false, username: null };
  }
}

export async function handleDisconnectGitHub(req: any) {
  const accountId: string = req.context.accountId;
  try {
    await disconnectGitHub(accountId);
    return { ok: true };
  } catch (error: any) {
    logger.error("Failed to disconnect GitHub", {
      phase: "github-oauth",
      accountId,
      error: error.message,
    });
    return { ok: false, error: error.message };
  }
}
