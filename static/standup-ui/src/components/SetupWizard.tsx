import React, { useState } from "react";
import Button from "@atlaskit/button/standard-button";
import Textfield from "@atlaskit/textfield";
import { invoke } from "@forge/bridge";
import SectionMessage from "@atlaskit/section-message";
import SlackConnect from "./SlackConnect";

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
  const [platform, setPlatform] = useState<"slack" | "teams">("slack");
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [showSlackWebhook, setShowSlackWebhook] = useState(false);
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [postingHour, setPostingHour] = useState(9);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTestTeamsWebhook = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await invoke<{ ok: boolean; error?: string }>(
        "testTeamsWebhook",
        { webhookUrl: teamsWebhookUrl }
      );
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message });
    }
    setTesting(false);
  };

  const canProceed =
    platform === "slack"
      ? slackConnected || (showSlackWebhook && slackWebhookUrl.startsWith("https://hooks.slack.com/"))
      : !!teamsWebhookUrl;

  const handleFinish = async () => {
    const payload: Record<string, any> = {
      timezone,
      postingHour,
      enabled: true,
      skipWeekends: true,
      projects: "all",
      format: "bullets",
      tone: "professional",
    };

    if (platform === "slack" && showSlackWebhook && slackWebhookUrl) {
      payload.slackWebhookUrl = slackWebhookUrl;
    }
    if (platform === "teams") {
      payload.teamsWebhookUrl = teamsWebhookUrl;
    }

    await onSave(payload);
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
          <h3>Connect your messaging platform</h3>
          <p>Choose Slack or Teams to receive your standup messages.</p>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <Button
              appearance={platform === "slack" ? "primary" : "subtle"}
              onClick={() => {
                setPlatform("slack");
                setTestResult(null);
              }}
            >
              Slack
            </Button>
            <Button
              appearance={platform === "teams" ? "primary" : "subtle"}
              onClick={() => {
                setPlatform("teams");
                setTestResult(null);
              }}
            >
              Microsoft Teams
            </Button>
          </div>

          {platform === "slack" ? (
            <div>
              <SlackConnect
                onConnectionChange={(connected) => setSlackConnected(connected)}
              />
              {!slackConnected && (
                <div style={{ marginTop: 16 }}>
                  {!showSlackWebhook ? (
                    <Button
                      appearance="subtle-link"
                      onClick={() => setShowSlackWebhook(true)}
                    >
                      Having trouble? Use a webhook URL instead
                    </Button>
                  ) : (
                    <div>
                      <p className="form-hint" style={{ marginBottom: 8 }}>
                        Paste your Slack Incoming Webhook URL:
                      </p>
                      <Textfield
                        placeholder="https://hooks.slack.com/services/T.../B.../..."
                        value={slackWebhookUrl}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setSlackWebhookUrl(e.target.value)
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="form-hint" style={{ marginBottom: 8 }}>
                In Teams, go to channel settings &rarr; Connectors &rarr;
                Incoming Webhook. Or use{" "}
                <a
                  href="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Workflows (Power Automate)
                </a>{" "}
                for newer Teams.
              </p>
              <Textfield
                placeholder="https://...webhook.office.com/..."
                value={teamsWebhookUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTeamsWebhookUrl(e.target.value)
                }
              />
              <div style={{ marginTop: 8 }}>
                <Button
                  appearance="subtle"
                  onClick={handleTestTeamsWebhook}
                  isDisabled={!teamsWebhookUrl || testing}
                >
                  Test Webhook
                </Button>
              </div>
              {testResult && (
                <div style={{ marginTop: 12 }}>
                  <SectionMessage
                    appearance={testResult.ok ? "success" : "error"}
                  >
                    <p>
                      {testResult.ok
                        ? "Webhook is working! Check your Teams channel."
                        : `Failed: ${testResult.error}`}
                    </p>
                  </SectionMessage>
                </div>
              )}
            </div>
          )}

          <div className="wizard-actions">
            <Button
              appearance="primary"
              onClick={() => setStep(1)}
              isDisabled={!canProceed}
            >
              Next
            </Button>
            <div style={{ flex: 1 }} />
            <Button appearance="subtle-link" onClick={handleSkip}>
              Skip for now
            </Button>
          </div>
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
