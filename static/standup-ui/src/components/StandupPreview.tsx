import React, { useState, useRef } from "react";
import Button from "@atlaskit/button/standard-button";
import Spinner from "@atlaskit/spinner";
import SectionMessage from "@atlaskit/section-message";
import { invoke } from "@forge/bridge";
import CopyButton from "./CopyButton";

function StandupPreview() {
  const [standup, setStandup] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [slackResult, setSlackResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setStandup(null);
    setEdited(false);
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
    if (!standup) return;
    setSending(true);
    setSlackResult(null);
    try {
      const result = await invoke<{ ok: boolean; error?: string }>(
        "sendEditedStandup",
        { text: standup }
      );
      setSlackResult(result);
    } catch (err: any) {
      setSlackResult({ ok: false, error: err.message });
    }
    setSending(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setStandup(e.target.value);
    setEdited(true);
    setSlackResult(null);
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  };

  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <Button
          appearance="primary"
          onClick={handleGenerate}
          isDisabled={loading}
        >
          Generate Preview
        </Button>
        {standup && (
          <>
            <CopyButton text={standup} />
            <Button
              appearance="warning"
              onClick={handleSendToSlack}
              isDisabled={sending}
            >
              Send to Slack
            </Button>
          </>
        )}
        {edited && (
          <span style={{ fontSize: 12, color: "#6B778C", fontStyle: "italic" }}>
            Edited
          </span>
        )}
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Spinner size="medium" />
          <span>Generating standup from Jira activity...</span>
        </div>
      )}

      {standup && (
        <textarea
          ref={textareaRef}
          value={standup}
          onChange={handleTextChange}
          onInput={autoResize}
          onFocus={autoResize}
          style={{
            width: "100%",
            minHeight: 180,
            background: "#f4f5f7",
            borderRadius: 8,
            padding: 16,
            fontFamily: "monospace",
            fontSize: 13,
            lineHeight: 1.6,
            border: "1px solid #dfe1e6",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      )}

      {standup && (
        <p style={{ fontSize: 11, color: "#97A0AF", margin: "6px 0 0" }}>
          You can edit the text above before sending to Slack.
        </p>
      )}

      {slackResult && (
        <div style={{ marginTop: 12 }}>
          <SectionMessage
            appearance={slackResult.ok ? "success" : "error"}
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
