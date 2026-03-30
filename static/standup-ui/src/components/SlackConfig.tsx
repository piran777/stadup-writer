import React, { useState } from "react";
import Button from "@atlaskit/button/standard-button";
import Textfield from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import { invoke } from "@forge/bridge";

type Props = {
  webhookUrl: string;
  onChange: (url: string) => void;
};

const WEBHOOK_PREFIX = "https://hooks.slack.com/";

function formatSlackTestError(raw?: string): string {
  const msg = (raw || "").trim();
  const m = msg.match(/returned\s+(\d{3})/i);
  const status = m ? Number(m[1]) : undefined;

  if (status === 401 || status === 403) {
    return "Slack rejected the request (401/403). Your workspace admin may block incoming webhooks or app installs. Ask an admin to allow incoming webhooks (or approve the app), or use Copy in Preview.";
  }
  if (status === 404) {
    return "Slack returned 404. This webhook may be disabled, revoked, or the URL is wrong. Create a new Incoming Webhook and try again.";
  }
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(msg)) {
    return "Network error testing this webhook. Your network/firewall may block outbound requests to Slack. Try again on a different network or ask IT to allow access to hooks.slack.com.";
  }

  return msg ? `Failed: ${msg}` : "Failed to test webhook. Please verify the URL and try again.";
}

function SlackConfig({ webhookUrl, onChange }: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);

  const isValidUrl = webhookUrl.startsWith(WEBHOOK_PREFIX);

  const handleTest = async () => {
    if (!isValidUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke<{ ok: boolean; error?: string }>(
        "testWebhook",
        { webhookUrl }
      );
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message || "Test failed" });
    }
    setTesting(false);
  };

  return (
    <div className="webhook-config">
      <label className="webhook-label">
        <span className="channel-tag slack" style={{ marginRight: 6 }}>Slack</span>
        Webhook URL
      </label>
      <p className="webhook-hint">
        Create at{" "}
        <a
          href="https://api.slack.com/apps"
          target="_blank"
          rel="noopener noreferrer"
        >
          api.slack.com/apps
        </a>{" "}
        &rarr; Incoming Webhooks &rarr; Add to channel.
      </p>
      <p className="form-hint" style={{ marginTop: 6 }}>
        Note: Some organizations restrict incoming webhooks. If you can’t create
        one, ask your Slack admin—or use Copy in the Preview tab.
      </p>

      <div className="inline-row">
        <div className="flex-1">
          <Textfield
            value={webhookUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(e.target.value)
            }
            placeholder="https://hooks.slack.com/services/T.../B.../..."
            isInvalid={webhookUrl.length > 0 && !isValidUrl}
          />
        </div>
        <Button
          appearance="subtle"
          onClick={handleTest}
          isDisabled={!isValidUrl || testing}
        >
          Test
        </Button>
      </div>

      {webhookUrl.length > 0 && !isValidUrl && (
        <p className="webhook-error">
          URL must start with https://hooks.slack.com/
        </p>
      )}

      {testResult && (
        <div style={{ marginTop: 8 }}>
          <SectionMessage
            appearance={testResult.ok ? "success" : "error"}
          >
            <p>
              {testResult.ok
                ? "Webhook works! Check your Slack channel."
                : formatSlackTestError(testResult.error)}
            </p>
          </SectionMessage>
        </div>
      )}
    </div>
  );
}

export default SlackConfig;
