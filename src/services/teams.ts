import api from "@forge/api";

const TEAMS_WEBHOOK_PREFIXES = [
  "https://outlook.office.com/webhook/",
  "https://outlook.office365.com/webhook/",
  ".webhook.office.com/",
];

export function isValidTeamsWebhookUrl(url: string): boolean {
  if (!url || !url.startsWith("https://")) return false;
  return TEAMS_WEBHOOK_PREFIXES.some((prefix) => url.includes(prefix));
}

export async function postToTeams(
  webhookUrl: string,
  standup: string,
  options?: { displayName?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!webhookUrl || !isValidTeamsWebhookUrl(webhookUrl)) {
    return { ok: false, error: "Invalid Teams webhook URL" };
  }

  try {
    const card = buildAdaptiveCard(standup, options?.displayName);

    const response = await api.fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `Teams returned ${response.status}: ${body}` };
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message || "Failed to post to Teams" };
  }
}

export async function testTeamsWebhook(
  webhookUrl: string
): Promise<{ ok: boolean; error?: string }> {
  return postToTeams(
    webhookUrl,
    "**Auto Standup Bot** -- Test message! Your webhook is working correctly."
  );
}

function buildAdaptiveCard(standup: string, displayName?: string): object {
  const sections = parseStandupSections(standup);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const title = displayName
    ? `${displayName}'s Standup — ${today}`
    : "Daily Standup";

  const bodyBlocks: any[] = [
    {
      type: "TextBlock",
      text: title,
      weight: "Bolder",
      size: "Medium",
      wrap: true,
    },
  ];

  for (const section of sections) {
    bodyBlocks.push({
      type: "TextBlock",
      text: section,
      wrap: true,
      spacing: "Small",
    });
  }

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: bodyBlocks,
        },
      },
    ],
  };
}

function parseStandupSections(standup: string): string[] {
  const converted = standup
    .replace(/\*([^*]+)\*/g, "**$1**")
    .replace(/^- /gm, "• ");

  return converted.split("\n").filter((line) => line.trim().length > 0);
}
