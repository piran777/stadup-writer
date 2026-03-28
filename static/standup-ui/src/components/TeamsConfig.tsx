import React, { useState } from "react";
import Button from "@atlaskit/button/standard-button";
import Textfield from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import { invoke } from "@forge/bridge";
import { isValidTeamsWebhookUrl } from "../utils/webhooks";

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

  const isValidUrl = isValidTeamsWebhookUrl(webhookUrl);

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
    <div className="webhook-config">
      <label className="webhook-label">
        <span className="channel-tag teams" style={{ marginRight: 6 }}>Teams</span>
        Webhook URL
      </label>
      <p className="webhook-hint">
        In Teams, go to channel settings &rarr; Connectors &rarr; Incoming
        Webhook. Or use{" "}
        <a
          href="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
          target="_blank"
          rel="noopener noreferrer"
        >
          Workflows (Power Automate)
        </a>{" "}
        for newer Teams.
      </p>

      <div className="inline-row">
        <div className="flex-1">
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
        <p className="webhook-error">
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
                ? "Webhook works! Check your Teams channel."
                : `Failed: ${testResult.error}`}
            </p>
          </SectionMessage>
        </div>
      )}
    </div>
  );
}

export default TeamsConfig;
