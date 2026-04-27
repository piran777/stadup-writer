import React, { useState } from "react";
import Button from "@atlaskit/button/standard-button";
import Textfield from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import { invoke } from "@forge/bridge";
import SlackConnect from "./SlackConnect";

type Props = {
  webhookUrl: string;
  onChange: (url: string) => void;
  onConnectionChange?: () => void;
};

const WEBHOOK_PREFIX = "https://hooks.slack.com/";

function formatSlackTestError(raw?: string): string {
  const msg = (raw || "").trim();
  const m = msg.match(/returned\s+(\d{3})/i);
  const status = m ? Number(m[1]) : undefined;

  if (status === 401 || status === 403) {
    return "Slack rejected the request (401/403). Your workspace admin may block incoming webhooks.";
  }
  if (status === 404) {
    return "Slack returned 404. This webhook may be disabled or revoked. Create a new one.";
  }
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(msg)) {
    return "Network error testing this webhook. Check your network or firewall settings.";
  }

  return msg ? `Failed: ${msg}` : "Failed to test webhook.";
}

function SlackConfig({ webhookUrl, onChange, onConnectionChange }: Props) {
  const [showWebhook, setShowWebhook] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);

  const isValidUrl = (webhookUrl || "").startsWith(WEBHOOK_PREFIX);

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
        Connection
      </label>

      <SlackConnect onConnectionChange={onConnectionChange} />

      <div style={{ marginTop: 16 }}>
        <Button
          appearance="subtle-link"
          onClick={() => setShowWebhook(!showWebhook)}
          spacing="compact"
        >
          {showWebhook ? "Hide" : "Advanced: Use webhook URL instead"}
        </Button>
      </div>

      {showWebhook && (
        <div style={{ marginTop: 8 }}>
          <p className="webhook-hint">
            Paste a webhook URL if you prefer manual setup over OAuth.
          </p>

          <div className="inline-row">
            <div className="flex-1">
              <Textfield
                value={webhookUrl || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onChange(e.target.value)
                }
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                isInvalid={(webhookUrl || "").length > 0 && !isValidUrl}
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

          {(webhookUrl || "").length > 0 && !isValidUrl && (
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
      )}
    </div>
  );
}

export default SlackConfig;
