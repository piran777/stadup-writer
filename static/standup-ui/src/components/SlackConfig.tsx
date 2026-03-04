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
    <div>
      <label style={{ fontWeight: 500, display: "block", marginBottom: 4 }}>
        Slack Webhook URL
      </label>
      <p style={{ fontSize: 12, color: "#6b778c", margin: "0 0 8px" }}>
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

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
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
          isLoading={testing}
        >
          Test
        </Button>
      </div>

      {webhookUrl.length > 0 && !isValidUrl && (
        <p style={{ color: "#de350b", fontSize: 12, marginTop: 4 }}>
          URL must start with https://hooks.slack.com/
        </p>
      )}

      {testResult && (
        <div style={{ marginTop: 8 }}>
          <SectionMessage
            appearance={testResult.ok ? "confirmation" : "error"}
          >
            <p>
              {testResult.ok
                ? "Webhook works! Check your Slack channel for the test message."
                : `Failed: ${testResult.error}`}
            </p>
          </SectionMessage>
        </div>
      )}
    </div>
  );
}

export default SlackConfig;
