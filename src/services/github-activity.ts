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

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "auto-standup-bot",
  };
}

function sinceDate(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

export type GitHubFilter = {
  orgs?: string[];
  orgOnly?: boolean;
};

async function fetchCommits(
  username: string,
  token: string,
  filter?: GitHubFilter
): Promise<GitHubCommit[]> {
  const since = sinceDate();
  let queryParts = `author:${username} author-date:>=${since}`;

  if (filter?.orgs && filter.orgs.length > 0) {
    const orgQueries = filter.orgs.map((org) => `org:${org}`).join(" ");
    queryParts += ` ${orgQueries}`;
  }

  const q = encodeURIComponent(queryParts);
  const url = `${GITHUB_API}/search/commits?q=${q}&sort=author-date&order=desc&per_page=30`;

  const response = await api.fetch(url, { headers: githubHeaders(token) });

  if (!response.ok) {
    logger.warn("GitHub commit search failed", {
      phase: "github",
      status: response.status,
    });
    return [];
  }

  const data = await response.json();
  const items = data.items || [];

  logger.info("GitHub commits fetched", {
    phase: "github",
    totalCount: data.total_count ?? 0,
    returned: items.length,
  });

  return items.map((item: any) => {
    const message = (item.commit?.message || "").split("\n")[0].slice(0, 120);
    const fullName = item.repository?.full_name || "";
    const repo = item.repository?.name || fullName || "unknown";
    return {
      repo: fullName || repo,
      message,
      sha: (item.sha || "").slice(0, 7),
      linkedTicket: extractTicketKeys(message),
    };
  });
}

async function fetchPullRequests(
  username: string,
  token: string,
  filter?: GitHubFilter
): Promise<GitHubPR[]> {
  const since = sinceDate();
  let queryParts = `author:${username} type:pr updated:>=${since}`;

  if (filter?.orgs && filter.orgs.length > 0) {
    const orgQueries = filter.orgs.map((org) => `org:${org}`).join(" ");
    queryParts += ` ${orgQueries}`;
  }

  const q = encodeURIComponent(queryParts);
  const url = `${GITHUB_API}/search/issues?q=${q}&sort=updated&order=desc&per_page=20`;

  const response = await api.fetch(url, { headers: githubHeaders(token) });

  if (!response.ok) {
    logger.warn("GitHub PR search failed", {
      phase: "github",
      status: response.status,
    });
    return [];
  }

  const data = await response.json();
  const items = data.items || [];

  logger.info("GitHub PRs fetched", {
    phase: "github",
    totalCount: data.total_count ?? 0,
    returned: items.length,
  });

  return items.map((item: any) => {
    const title = (item.title || "").slice(0, 120);
    const repoUrl = item.repository_url || "";
    const repoParts = repoUrl.replace("https://api.github.com/repos/", "");
    const repo = repoParts || repoUrl.split("/").pop() || "unknown";
    let action: GitHubPR["action"] = "opened";
    if (item.pull_request?.merged_at) {
      action = "merged";
    } else if (item.state === "closed") {
      action = "closed";
    }
    return {
      repo,
      title,
      number: item.number,
      action,
      linkedTicket: extractTicketKeys(title),
    };
  });
}

async function fetchUserOrgs(
  username: string,
  token: string
): Promise<string[]> {
  try {
    const response = await api.fetch(`${GITHUB_API}/user/orgs?per_page=100`, {
      headers: githubHeaders(token),
    });
    if (!response.ok) return [];
    const orgs: any[] = await response.json();
    return orgs.map((o: any) => o.login);
  } catch {
    return [];
  }
}

export async function fetchGitHubActivity(
  username: string,
  token: string,
  filter?: GitHubFilter
): Promise<GitHubActivity> {
  if (!username || !token) {
    return emptyGitHubActivity();
  }

  try {
    const hasOrgFilter = filter?.orgs && filter.orgs.length > 0;
    const searchFilter = hasOrgFilter ? filter : undefined;

    let [commits, pullRequests] = await Promise.all([
      fetchCommits(username, token, searchFilter),
      fetchPullRequests(username, token, searchFilter),
    ]);

    if (!hasOrgFilter && filter?.orgOnly) {
      const userOrgs = await fetchUserOrgs(username, token);
      const orgSet = new Set(userOrgs.map((o) => o.toLowerCase()));
      commits = commits.filter((c) => {
        const owner = c.repo.includes("/") ? c.repo.split("/")[0].toLowerCase() : "";
        return owner !== username.toLowerCase() && (orgSet.size === 0 || orgSet.has(owner));
      });
      pullRequests = pullRequests.filter((pr) => {
        const owner = pr.repo.includes("/") ? pr.repo.split("/")[0].toLowerCase() : "";
        return owner !== username.toLowerCase() && (orgSet.size === 0 || orgSet.has(owner));
      });
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
