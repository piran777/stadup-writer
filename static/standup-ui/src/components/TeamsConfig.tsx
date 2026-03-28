import React, { useState } from "react";
import Button from "@atlaskit/button/standard-button";
import Textfield from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import { invoke } from "@forge/bridge";

type Props = {
  webhookUrl: string;
  onChange: (url: string) => void;
};

function TeamsConfig({ webhookUrl, onChange }: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);

  const isValidUrl =
    webhookUrl.length > 0 &&
    webhookUrl.startsWith("https://") &&
    webhookUrl.includes(".webhook.office.com");

  const handleTest = async () => {
    if (!isValidUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke<{ ok: boolean; error?: string }>(
        "testTeamsWebhook",
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
        Microsoft Teams Webhook URL
      </label>
      <p style={{ fontSize: 12, color: "#6b778c", margin: "0 0 8px" }}>
        In Teams, go to channel settings &rarr; Connectors &rarr; Incoming
        Webhook &rarr; Configure. Or use{" "}
        <a
          href="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
          target="_blank"
          rel="noopener noreferrer"
        >
          Workflows (Power Automate)
        </a>{" "}
        for newer Teams.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <Textfield
            value={webhookUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(e.target.value)
            }
            placeholder="https://...webhook.office.com/webhookb2/..."
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
        <p style={{ color: "#de350b", fontSize: 12, marginTop: 4 }}>
          URL should be a Microsoft Teams webhook (*.webhook.office.com)
        </p>
      )}

      {testResult && (
        <div style={{ marginTop: 8 }}>
          <SectionMessage
            appearance={testResult.ok ? "success" : "error"}
          >
            <p>
              {testResult.ok
                ? "Webhook works! Check your Teams channel for the test message."
                : `Failed: ${testResult.error}`}
            </p>
          </SectionMessage>
        </div>
      )}
    </div>
  );
}

export default TeamsConfig;
