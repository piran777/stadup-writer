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

  const handleSkip = () => {
    onComplete();
  };

  const formatHour = (h: number) => {
    if (h === 0) return "12:00 AM";
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return "12:00 PM";
    return `${h - 12}:00 PM`;
  };

  const totalSteps = 3;

  return (
    <div className="wizard-container standup-app">
      <div className="wizard-header">
        <h2>Welcome to Auto Standup Bot</h2>
        <p>Get set up in 3 quick steps</p>
      </div>

      <div className="wizard-progress">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`wizard-dot ${
              i < step ? "completed" : i === step ? "active" : ""
            }`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="wizard-step">
          <h3>Messaging Webhook</h3>
          <p>
            Paste a Slack Incoming Webhook URL to start. You can add Microsoft
            Teams later in Settings.{" "}
            <a
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noopener noreferrer"
            >
              How to create a Slack webhook
            </a>
          </p>
          <Textfield
            placeholder="https://hooks.slack.com/services/T.../B.../..."
            value={webhookUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setWebhookUrl(e.target.value)
            }
          />
          <div className="wizard-actions">
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
            <div style={{ flex: 1 }} />
            <Button
              appearance="subtle-link"
              onClick={handleSkip}
            >
              Skip for now
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
        <div className="wizard-step">
          <h3>Your Timezone</h3>
          <p>We'll use this to post standups at the right time for you.</p>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="form-select"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <div className="wizard-actions">
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
        <div className="wizard-step">
          <h3>Posting Time</h3>
          <p>
            When should your standup be posted each workday? Tip: set this 1
            hour before your desired delivery for best accuracy.
          </p>
          <select
            value={postingHour}
            onChange={(e) => setPostingHour(parseInt(e.target.value, 10))}
            className="form-select"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
          <div className="wizard-actions">
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
