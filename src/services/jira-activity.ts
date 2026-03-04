import api, { route } from "@forge/api";
import { UserActivity } from "../types";
import { logger } from "../utils/logger";

const MAX_ISSUES = 50;
const MAX_CHANGELOG_ISSUES = 20;

export async function fetchUserActivity(
  accountId: string,
  projectKeys?: string[] | "all"
): Promise<UserActivity> {
  try {
    const issues = await searchRecentIssues(accountId, projectKeys);

    if (issues.length === 0) {
      return emptyActivity();
    }

    return buildActivityFromIssues(issues, accountId);
  } catch (error: any) {
    logger.error("Failed to fetch user activity", {
      accountId,
      phase: "jira",
      error: error.message,
    });
    return emptyActivity();
  }
}

function emptyActivity(): UserActivity {
  return { completed: [], inProgress: [], commented: [], blocked: [] };
}

async function searchRecentIssues(
  accountId: string,
  projectKeys?: string[] | "all"
): Promise<any[]> {
  let jql = `assignee = "${accountId}" AND updated >= -1d ORDER BY updated DESC`;

  if (projectKeys && projectKeys !== "all" && projectKeys.length > 0) {
    const projectFilter = projectKeys.map((k) => `"${k}"`).join(", ");
    jql = `assignee = "${accountId}" AND project IN (${projectFilter}) AND updated >= -1d ORDER BY updated DESC`;
  }

  const response = await api
    .asApp()
    .requestJira(
      route`/rest/api/3/search?jql=${jql}&maxResults=${MAX_ISSUES}&fields=summary,status,project,comment`
    );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Jira search failed: ${response.status} ${response.statusText} - ${body}`
    );
  }

  const data = await response.json();
  return data.issues || [];
}

async function fetchIssueChangelog(issueKey: string): Promise<any[]> {
  try {
    const response = await api
      .asApp()
      .requestJira(route`/rest/api/3/issue/${issueKey}?expand=changelog`);

    if (!response.ok) {
      logger.warn("Changelog fetch failed for issue", {
        phase: "jira",
        issueKey,
        status: response.status,
      });
      return [];
    }

    const data = await response.json();
    return data.changelog?.histories || [];
  } catch (error: any) {
    logger.warn("Changelog fetch error", {
      phase: "jira",
      issueKey,
      error: error.message,
    });
    return [];
  }
}

function isWithin24Hours(dateStr: string): boolean {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

async function buildActivityFromIssues(
  issues: any[],
  accountId: string
): Promise<UserActivity> {
  const activity: UserActivity = {
    completed: [],
    inProgress: [],
    commented: [],
    blocked: [],
  };

  const issuesToExpand = issues.slice(0, MAX_CHANGELOG_ISSUES);

  for (const issue of issuesToExpand) {
    const key = issue.key;
    const summary = issue.fields?.summary || key;
    const currentStatus = issue.fields?.status?.name?.toLowerCase() || "";

    const histories = await fetchIssueChangelog(key);

    const statusTransitions = histories
      .filter(
        (h: any) =>
          h.author?.accountId === accountId && isWithin24Hours(h.created)
      )
      .flatMap((h: any) =>
        (h.items || []).filter((item: any) => item.field === "status")
      );

    let hadCompletionTransition = false;

    for (const transition of statusTransitions) {
      const to = transition.toString?.toLowerCase() || "";
      if (to === "done" || to === "closed" || to === "resolved") {
        activity.completed.push({
          key,
          summary,
          from: transition.fromString || "Unknown",
          to: transition.toString || "Done",
        });
        hadCompletionTransition = true;
      }
    }

    if (
      !hadCompletionTransition &&
      statusTransitions.length === 0 &&
      (currentStatus === "in progress" || currentStatus === "in review")
    ) {
      activity.inProgress.push({ key, summary });
    }

    if (currentStatus === "blocked" || currentStatus === "impediment") {
      activity.blocked.push({ key, summary });
    }

    const comments = issue.fields?.comment?.comments || [];
    const recentUserComments = comments.filter(
      (c: any) =>
        c.author?.accountId === accountId && isWithin24Hours(c.created)
    );

    for (const comment of recentUserComments) {
      const body =
        typeof comment.body === "string"
          ? comment.body
          : extractTextFromAdf(comment.body);
      activity.commented.push({
        key,
        summary,
        commentSnippet: body.slice(0, 120),
      });
    }
  }

  for (const issue of issues.slice(MAX_CHANGELOG_ISSUES)) {
    const currentStatus = issue.fields?.status?.name?.toLowerCase() || "";
    if (currentStatus === "in progress" || currentStatus === "in review") {
      activity.inProgress.push({
        key: issue.key,
        summary: issue.fields?.summary || issue.key,
      });
    }
    if (currentStatus === "blocked" || currentStatus === "impediment") {
      activity.blocked.push({
        key: issue.key,
        summary: issue.fields?.summary || issue.key,
      });
    }
  }

  return activity;
}

function extractTextFromAdf(adf: any): string {
  if (!adf || !adf.content) return "";

  const texts: string[] = [];

  function walk(node: any) {
    if (node.type === "text" && node.text) {
      texts.push(node.text);
    }
    if (node.content) {
      node.content.forEach(walk);
    }
  }

  adf.content.forEach(walk);
  return texts.join(" ");
}
