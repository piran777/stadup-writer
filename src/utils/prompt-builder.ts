import { UserActivity } from "../types";

export function buildPrompt(
  activity: UserActivity,
  format: "bullets" | "prose",
  tone: "casual" | "professional"
): { system: string; user: string } {
  const toneInstruction =
    tone === "casual"
      ? "Use a friendly, conversational tone."
      : "Use a clear, professional tone.";

  const formatInstruction =
    format === "prose"
      ? "Write the standup as short paragraphs instead of bullet points."
      : "Use bullet points for each section.";

  const system = [
    "You are a concise standup summary writer.",
    "Given Jira ticket activity, write a standup update.",
    "Be brief and specific. Use ticket keys (e.g., DEMO-42).",
    "No filler words or unnecessary pleasantries.",
    toneInstruction,
    formatInstruction,
    'Use Slack mrkdwn formatting: *bold* for headers, - for bullets.',
  ].join(" ");

  const activityLines: string[] = [];

  if (activity.completed.length > 0) {
    activityLines.push("Completed:");
    activity.completed.forEach((t) =>
      activityLines.push(`- ${t.key} "${t.summary}" (${t.from} -> ${t.to})`)
    );
  }

  if (activity.inProgress.length > 0) {
    activityLines.push("\nIn Progress:");
    activity.inProgress.forEach((t) =>
      activityLines.push(`- ${t.key} "${t.summary}"`)
    );
  }

  if (activity.commented.length > 0) {
    activityLines.push("\nComments:");
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

  const outputFormat =
    format === "prose"
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

  const user = [
    "Generate a standup summary from this activity:\n",
    activityLines.join("\n"),
    "\n" + outputFormat,
  ].join("\n");

  return { system, user };
}
