import React, { useState } from "react";
import Button from "@atlaskit/button/standard-button";
import Spinner from "@atlaskit/spinner";
import SectionMessage from "@atlaskit/section-message";
import { invoke } from "@forge/bridge";

function StandupPreview() {
  const [standup, setStandup] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [slackResult, setSlackResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setStandup(null);
    setSlackResult(null);
    try {
      const result = await invoke<{ standup: string }>("generateStandup", {
        sendToSlack: false,
      });
      setStandup(result.standup);
    } catch (err: any) {
      setStandup(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  const handleSendToSlack = async () => {
    setSending(true);
    setSlackResult(null);
    try {
      const result = await invoke<{
        standup: string;
        slackResult?: { ok: boolean; error?: string };
      }>("generateStandup", { sendToSlack: true });
      setSlackResult(result.slackResult || { ok: false, error: "No result" });
    } catch (err: any) {
      setSlackResult({ ok: false, error: err.message });
    }
    setSending(false);
  };

  const handleCopy = () => {
    if (standup) {
      navigator.clipboard.writeText(standup);
    }
  };

  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Button
          appearance="primary"
          onClick={handleGenerate}
          isDisabled={loading}
        >
          Generate Preview
        </Button>
        {standup && (
          <>
            <Button appearance="default" onClick={handleCopy}>
              Copy
            </Button>
            <Button
              appearance="warning"
              onClick={handleSendToSlack}
              isLoading={sending}
            >
              Send to Slack
            </Button>
          </>
        )}
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Spinner size="medium" />
          <span>Generating standup from Jira activity...</span>
        </div>
      )}

      {standup && (
        <div
          style={{
            background: "#f4f5f7",
            borderRadius: 8,
            padding: 16,
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            fontSize: 13,
            lineHeight: 1.6,
            border: "1px solid #dfe1e6",
          }}
        >
          {standup}
        </div>
      )}

      {slackResult && (
        <div style={{ marginTop: 12 }}>
          <SectionMessage
            appearance={slackResult.ok ? "confirmation" : "error"}
          >
            <p>
              {slackResult.ok
                ? "Standup posted to Slack!"
                : `Slack error: ${slackResult.error}`}
            </p>
          </SectionMessage>
        </div>
      )}
    </div>
  );
}

export default StandupPreview;
