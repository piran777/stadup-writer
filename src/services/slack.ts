import api from "@forge/api";

export async function postToSlack(
  webhookUrl: string,
  standup: string
): Promise<{ ok: boolean; error?: string }> {
  if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/")) {
    return { ok: false, error: "Invalid Slack webhook URL" };
  }

  try {
    const response = await api.fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: standup,
        unfurl_links: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `Slack returned ${response.status}: ${body}` };
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message || "Failed to post to Slack" };
  }
}

export async function testSlackWebhook(
  webhookUrl: string
): Promise<{ ok: boolean; error?: string }> {
  return postToSlack(
    webhookUrl,
    "🔔 *Auto Standup Bot* -- Test message! Your webhook is working correctly."
  );
}
