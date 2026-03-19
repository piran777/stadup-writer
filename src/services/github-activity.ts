import api from "@forge/api";
import { GitHubActivity, GitHubCommit, GitHubPR } from "../types";
import { logger } from "../utils/logger";

const GITHUB_API = "https://api.github.com";
const JIRA_KEY_REGEX = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

function emptyGitHubActivity(): GitHubActivity {
  return { commits: [], pullRequests: [] };
}

function extractTicketKeys(text: string): string | undefined {
  const matches = text.match(JIRA_KEY_REGEX);
  return matches?.[0];
}

function isWithin24Hours(dateStr: string): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const diff = Date.now() - date.getTime();
  return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
}

export async function fetchGitHubActivity(
  username: string,
  token: string
): Promise<GitHubActivity> {
  if (!username || !token) {
    return emptyGitHubActivity();
  }

  try {
    const response = await api.fetch(
      `${GITHUB_API}/users/${encodeURIComponent(username)}/events?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "auto-standup-bot",
        },
      }
    );

    if (!response.ok) {
      logger.warn("GitHub events fetch failed", {
        phase: "github",
        status: response.status,
        username,
      });
      return emptyGitHubActivity();
    }

    const events: any[] = await response.json();

    logger.info("GitHub events fetched", {
      phase: "github",
      totalEvents: events.length,
      username,
    });

    const recentEvents = events.filter(
      (e) => e.created_at && isWithin24Hours(e.created_at)
    );

    const commits: GitHubCommit[] = [];
    const pullRequests: GitHubPR[] = [];
    const seenPRs = new Set<string>();

    for (const event of recentEvents) {
      const repo = event.repo?.name?.split("/").pop() || event.repo?.name || "unknown";

      if (event.type === "PushEvent") {
        const pushCommits = event.payload?.commits || [];
        for (const c of pushCommits) {
          const message = (c.message || "").split("\n")[0].slice(0, 120);
          commits.push({
            repo,
            message,
            sha: (c.sha || "").slice(0, 7),
            linkedTicket: extractTicketKeys(message),
          });
        }
      }

      if (event.type === "PullRequestEvent") {
        const pr = event.payload?.pull_request;
        const action = event.payload?.action;
        if (!pr) continue;

        const prKey = `${repo}#${pr.number}`;
        if (seenPRs.has(prKey)) continue;
        seenPRs.add(prKey);

        let prAction: GitHubPR["action"] = "opened";
        if (action === "closed" && pr.merged) {
          prAction = "merged";
        } else if (action === "closed") {
          prAction = "closed";
        } else if (action === "opened" || action === "reopened") {
          prAction = "opened";
        }

        const title = (pr.title || "").slice(0, 120);
        pullRequests.push({
          repo,
          title,
          number: pr.number,
          action: prAction,
          linkedTicket: extractTicketKeys(title),
        });
      }

      if (event.type === "PullRequestReviewEvent") {
        const pr = event.payload?.pull_request;
        if (!pr) continue;

        const prKey = `${repo}#${pr.number}-review`;
        if (seenPRs.has(prKey)) continue;
        seenPRs.add(prKey);

        const title = (pr.title || "").slice(0, 120);
        pullRequests.push({
          repo,
          title,
          number: pr.number,
          action: "reviewed",
          linkedTicket: extractTicketKeys(title),
        });
      }
    }

    logger.info("GitHub activity parsed", {
      phase: "github",
      commits: commits.length,
      pullRequests: pullRequests.length,
    });

    return { commits, pullRequests };
  } catch (error: any) {
    logger.error("GitHub activity fetch error", {
      phase: "github",
      error: error.message,
    });
    return emptyGitHubActivity();
  }
}
