import api from "@forge/api";
import { UserActivity, GitHubActivity } from "../types";
import { buildPrompt } from "../utils/prompt-builder";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;

export async function generateStandup(
  activity: UserActivity,
  format: "bullets" | "prose" = "bullets",
  tone: "casual" | "professional" = "professional",
  github?: GitHubActivity
): Promise<string> {
  const hasGitHub = github && (github.commits.length > 0 || github.pullRequests.length > 0);
  if (isEmptyActivity(activity) && !hasGitHub) {
    return "No Jira activity in the last 24 hours.";
  }

  const prompt = buildPrompt(activity, format, tone, github);

  try {
    return await callOpenAI(prompt);
  } catch (error: any) {
    if (error.status === 429) {
      await sleep(RETRY_DELAY_MS);
      try {
        return await callOpenAI(prompt);
      } catch {
        return buildFallbackStandup(activity);
      }
    }
    return buildFallbackStandup(activity);
  }
}

async function callOpenAI(prompt: {
  system: string;
  user: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await api.fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      max_tokens: 300,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err: any = new Error(`OpenAI API error: ${response.status}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "Failed to generate standup.";
}

function isEmptyActivity(activity: UserActivity): boolean {
  return (
    activity.completed.length === 0 &&
    activity.inProgress.length === 0 &&
    activity.commented.length === 0 &&
    activity.blocked.length === 0
  );
}

function buildFallbackStandup(activity: UserActivity): string {
  const lines: string[] = ["*Yesterday:*"];

  if (activity.completed.length > 0) {
    activity.completed.forEach((t) =>
      lines.push(`- ${t.key}: ${t.summary} (${t.from} → ${t.to})`)
    );
  } else {
    lines.push("- No completed items");
  }

  lines.push("\n*Today:*");
  if (activity.inProgress.length > 0) {
    activity.inProgress.forEach((t) =>
      lines.push(`- ${t.key}: ${t.summary}`)
    );
  } else {
    lines.push("- Continuing current work");
  }

  lines.push("\n*Blockers:*");
  if (activity.blocked.length > 0) {
    activity.blocked.forEach((t) =>
      lines.push(`- ${t.key}: ${t.summary}`)
    );
  } else {
    lines.push("- None");
  }

  return lines.join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
