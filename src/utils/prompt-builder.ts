import { UserActivity, GitHubActivity } from "../types";

export type PromptOptions = {
  format: "bullets" | "prose";
  tone: "casual" | "professional";
  github?: GitHubActivity;
  isWeeklyDigest?: boolean;
  customPrompt?: string;
};

export function buildPrompt(
  activity: UserActivity,
  format: "bullets" | "prose",
  tone: "casual" | "professional",
  github?: GitHubActivity,
  options?: { isWeeklyDigest?: boolean; customPrompt?: string }
): { system: string; user: string } {
  const isWeekly = options?.isWeeklyDigest ?? false;
  const customPrompt = options?.customPrompt?.trim();

  const toneInstruction =
    tone === "casual"
      ? "Use a friendly, conversational tone."
      : "Use a clear, professional tone.";

  const formatInstruction =
    format === "prose"
      ? isWeekly
        ? "Write the weekly summary as short paragraphs."
        : "Write the standup as short paragraphs instead of bullet points."
      : "Use bullet points for each section.";

  const hasGitHub = github && (github.commits.length > 0 || github.pullRequests.length > 0);

  const systemParts = isWeekly
    ? [
        "You are a concise weekly progress summary writer.",
        "Given a full week of Jira ticket activity" + (hasGitHub ? " and GitHub development activity" : "") + ", write a weekly digest.",
        "Group related work together. Highlight key accomplishments, ongoing work, and blockers.",
        "Be brief and specific. Use ticket keys (e.g., DEMO-42) when available.",
        hasGitHub ? "When a GitHub commit or PR is linked to a Jira ticket, combine them into one bullet instead of listing separately." : "",
        "No filler words or unnecessary pleasantries.",
      ]
    : [
        "You are a concise standup summary writer.",
        "Given Jira ticket activity" + (hasGitHub ? " and GitHub development activity" : "") + ", write a standup update.",
        "Be brief and specific. Use ticket keys (e.g., DEMO-42) when available.",
        hasGitHub ? "When a GitHub commit or PR is linked to a Jira ticket, combine them into one bullet instead of listing separately." : "",
        "No filler words or unnecessary pleasantries.",
      ];

  systemParts.push(toneInstruction, formatInstruction);
  systemParts.push('Use Slack mrkdwn formatting: *bold* for headers, - for bullets.');

  if (customPrompt) {
    systemParts.push(`Additional instructions from the user: ${customPrompt}`);
  }

  const system = systemParts.filter(Boolean).join(" ");

  const activityLines: string[] = [];

  if (activity.completed.length > 0) {
    activityLines.push("Completed Jira tickets:");
    activity.completed.forEach((t) =>
      activityLines.push(`- ${t.key} "${t.summary}" (${t.from} -> ${t.to})`)
    );
  }

  if (activity.inProgress.length > 0) {
    activityLines.push("\nIn Progress Jira tickets:");
    activity.inProgress.forEach((t) =>
      activityLines.push(`- ${t.key} "${t.summary}"`)
    );
  }

  if (activity.commented.length > 0) {
    activityLines.push("\nJira Comments:");
    activity.commented.forEach((t) =>
      activityLines.push(`- ${t.key}: "${t.commentSnippet}"`)
    );
  }

  if (activity.blocked.length > 0) {
    activityLines.push("\nBlocked:");
    activity.blocked.forEach((t) =>
      activityLines.push(`- ${t.key} "${t.summary}"`)
    );
  }

  if (hasGitHub) {
    if (github!.commits.length > 0) {
      activityLines.push("\nGitHub Commits:");
      github!.commits.forEach((c) => {
        const ticket = c.linkedTicket ? ` [${c.linkedTicket}]` : "";
        activityLines.push(`- ${c.repo} (${c.sha}): "${c.message}"${ticket}`);
      });
    }

    if (github!.pullRequests.length > 0) {
      activityLines.push("\nGitHub Pull Requests:");
      github!.pullRequests.forEach((pr) => {
        const ticket = pr.linkedTicket ? ` [${pr.linkedTicket}]` : "";
        activityLines.push(`- ${pr.repo} #${pr.number} (${pr.action}): "${pr.title}"${ticket}`);
      });
    }
  }

  let outputFormat: string;

  if (isWeekly) {
    outputFormat = format === "prose"
      ? "Output as short paragraphs for Accomplishments, Ongoing Work, and Blockers/Risks."
      : [
          "Output format:",
          "*This Week's Accomplishments:*",
          "- bullet points",
          "",
          "*Ongoing Work:*",
          "- bullet points",
          "",
          "*Blockers / Risks:*",
          '- bullet points or "None"',
          "",
          "*Next Week Focus:*",
          "- bullet points",
        ].join("\n");
  } else {
    outputFormat = format === "prose"
      ? "Output as short paragraphs for Yesterday, Today, and Blockers."
      : [
          "Output format:",
          "*Yesterday:*",
          "- bullet points",
          "",
          "*Today:*",
          "- bullet points",
          "",
          "*Blockers:*",
          '- bullet points or "None"',
        ].join("\n");
  }

  const intro = isWeekly
    ? "Generate a weekly progress digest from this week's activity:\n"
    : "Generate a standup summary from this activity:\n";

  const user = [
    intro,
    activityLines.join("\n"),
    "\n" + outputFormat,
  ].join("\n");

  return { system, user };
}
