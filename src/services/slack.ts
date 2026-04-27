import api from "@forge/api";
import kvs from "@forge/kvs";

type SlackPostOptions = {
  displayName?: string;
  botToken?: string;
  channelId?: string;
};

export async function postToSlack(
  webhookUrl: string,
  standup: string,
  options?: SlackPostOptions
): Promise<{ ok: boolean; error?: string }> {
  const displayName = options?.displayName;
  let text = standup;

  if (displayName) {
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    text = `*${displayName}'s Standup* — ${today}\n\n${standup}`;
  }

  if (options?.botToken && options?.channelId) {
    return postViaApi(options.botToken, options.channelId, text);
  }

  return postViaWebhook(webhookUrl, text);
}

async function postViaWebhook(
  webhookUrl: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/")) {
    return { ok: false, error: "Invalid Slack webhook URL" };
  }

  try {
    const response = await api.fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, unfurl_links: false }),
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

async function postViaApi(
  botToken: string,
  channelId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const dateKey = new Date().toISOString().split("T")[0];
    const threadKey = `slack-thread:${channelId}:${dateKey}`;
    const existingThread = (await kvs.get(threadKey)) as string | undefined;

    const payload: Record<string, any> = {
      channel: channelId,
      text,
      unfurl_links: false,
    };

    if (existingThread) {
      payload.thread_ts = existingThread;
    }

    const response = await api.fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `Slack API returned ${response.status}: ${body}` };
    }

    const data = await response.json();

    if (!data.ok) {
      return { ok: false, error: `Slack API error: ${data.error || "unknown"}` };
    }

    if (!existingThread && data.ts) {
      await kvs.set(threadKey, data.ts);
    }

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message || "Failed to post to Slack" };
  }
}

export async function testSlackWebhook(
  webhookUrl: string
): Promise<{ ok: boolean; error?: string }> {
  return postViaWebhook(
    webhookUrl,
    "🔔 *Auto Standup Bot* — Test message! Your webhook is working correctly."
  );
}

export async function testSlackConnection(
  botToken: string,
  channelId: string
): Promise<{ ok: boolean; error?: string }> {
  return postViaApi(
    botToken,
    channelId,
    "🔔 *Auto Standup Bot* — Test message! Your Slack connection is working correctly."
  );
}
