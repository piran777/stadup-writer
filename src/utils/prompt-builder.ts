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
        "You are a senior engineer writing a concise weekly progress summary.",
        "Given a full week of Jira ticket activity" + (hasGitHub ? " and code changes" : "") + ", write a clear, brief weekly digest.",
        "Group related work together. Keep each bullet to 1-2 short sentences. State what was done, not why it matters. Do not pad with filler.",
        "CRITICAL: Only reference ticket keys, commit SHAs, and facts from the provided data. NEVER fabricate or invent details not in the input.",
        "NOISE REDUCTION: If multiple tickets are part of the same feature, group them into one bullet. Skip trivial items.",
        hasGitHub ? "Always include code changes. NEVER say 'In GitHub' or 'on GitHub' — just describe the work. When a commit is linked to a Jira ticket (shown with [TICKET-KEY]), combine them. Unlinked commits get their own bullet." : "",
        "No filler words or unnecessary pleasantries.",
      ]
    : [
        "You are a senior engineer writing a concise standup update.",
        "Given Jira ticket activity" + (hasGitHub ? " and code changes" : "") + ", write a clear, brief standup.",
        "Keep each bullet to 1-2 short sentences max. State what was done, not why it matters. Do not pad with filler like 'improving efficiency' or 'enhancing user experience'.",
        "CRITICAL: Only reference ticket keys, commit SHAs, and facts from the provided data. NEVER fabricate or invent details not in the input.",
        "For the *Today:* section, ONLY list tickets that are currently In Progress. If none, say '- Continuing current work'.",
        "NOISE REDUCTION: If multiple tickets are part of the same feature, group them into one bullet. Skip trivial items.",
        hasGitHub ? "Always include code changes in the output. NEVER say 'In GitHub' or 'on GitHub' — just describe the work. When a commit is linked to a Jira ticket (shown with [TICKET-KEY]), combine them. Unlinked commits get their own bullet." : "",
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
      activityLines.push("\nCode changes (do not mention 'GitHub' in output — just describe the work):");
      github!.commits.forEach((c) => {
        const ticket = c.linkedTicket ? ` [${c.linkedTicket}]` : "";
        activityLines.push(`- ${c.repo} (${c.sha}): "${c.message}"${ticket}`);
      });
    }

    if (github!.pullRequests.length > 0) {
      activityLines.push("\nPull requests (do not mention 'GitHub' in output — just describe the work):");
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
          "Output format (include a blank line between each section):",
          "",
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
          "Output format (include a blank line between each section). Cover every ticket and commit — do not skip any — but describe each in your own words as a meaningful standup update, not a raw data dump:",
          "",
          "*Yesterday:*",
          "- Summarize completed work and GitHub commits. Describe what was done and why it matters.",
          "",
          "*Today:*",
          "- Summarize in-progress tickets. Describe what you're working on. If none, say 'Continuing current work'.",
          "",
          "*Blockers:*",
          '- Describe any blockers or "None"',
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
