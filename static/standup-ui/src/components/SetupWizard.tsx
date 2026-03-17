import React, { useState } from "react";
import Button from "@atlaskit/button/standard-button";
import Textfield from "@atlaskit/textfield";
import { invoke } from "@forge/bridge";
import SectionMessage from "@atlaskit/section-message";

type Props = {
  onComplete: () => void;
  onSave: (updates: Record<string, any>) => Promise<void>;
};

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const HOURS = Array.from({ length: 13 }, (_, i) => i + 6);

function SetupWizard({ onComplete, onSave }: Props) {
  const [step, setStep] = useState(0);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [postingHour, setPostingHour] = useState(9);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTestWebhook = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke<{ ok: boolean; error?: string }>(
        "testWebhook",
        { webhookUrl }
      );
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message });
    }
    setTesting(false);
  };

  const handleFinish = async () => {
    await onSave({
      slackWebhookUrl: webhookUrl,
      timezone,
      postingHour,
      enabled: true,
      skipWeekends: true,
      projects: "all",
      format: "bullets",
      tone: "professional",
    });
    onComplete();
  };

  const formatHour = (h: number) => {
    if (h === 0) return "12:00 AM";
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return "12:00 PM";
    return `${h - 12}:00 PM`;
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 24px" }}>
      <h2 style={{ marginBottom: 8 }}>Welcome to Auto Standup Bot</h2>
      <p style={{ color: "#6b778c", marginBottom: 32 }}>
        Let's get you set up in 3 quick steps.
      </p>

      {step === 0 && (
        <div>
          <h3>Step 1: Slack Webhook URL</h3>
          <p style={{ fontSize: 14, color: "#6b778c", marginBottom: 12 }}>
            Create a Slack app with an Incoming Webhook and paste the URL here.{" "}
            <a
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noopener noreferrer"
            >
              How to create a webhook
            </a>
          </p>
          <Textfield
            placeholder="https://hooks.slack.com/services/T.../B.../..."
            value={webhookUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setWebhookUrl(e.target.value)
            }
          />
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <Button
              appearance="subtle"
              onClick={handleTestWebhook}
              isDisabled={!webhookUrl || testing}
            >
              Test Webhook
            </Button>
            <Button
              appearance="primary"
              onClick={() => setStep(1)}
              isDisabled={!webhookUrl}
            >
              Next
            </Button>
          </div>
          {testResult && (
            <div style={{ marginTop: 12 }}>
              <SectionMessage
                appearance={testResult.ok ? "success" : "error"}
              >
                <p>
                  {testResult.ok
                    ? "Webhook is working! Check your Slack channel."
                    : `Failed: ${testResult.error}`}
                </p>
              </SectionMessage>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div>
          <h3>Step 2: Your Timezone</h3>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 3,
              border: "1px solid #dfe1e6",
              fontSize: 14,
            }}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <Button appearance="subtle" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button appearance="primary" onClick={() => setStep(2)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3>Step 3: Posting Time</h3>
          <p style={{ fontSize: 14, color: "#6b778c", marginBottom: 12 }}>
            When should your standup be posted to Slack each weekday?
          </p>
          <select
            value={postingHour}
            onChange={(e) => setPostingHour(parseInt(e.target.value, 10))}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 3,
              border: "1px solid #dfe1e6",
              fontSize: 14,
            }}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
            <Button appearance="subtle" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button appearance="primary" onClick={handleFinish}>
              Enable Auto Standup
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SetupWizard;
