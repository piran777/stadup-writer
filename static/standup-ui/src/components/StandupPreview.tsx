import React, { useState, useRef, useLayoutEffect } from "react";
import Button from "@atlaskit/button/standard-button";
import Spinner from "@atlaskit/spinner";
import SectionMessage from "@atlaskit/section-message";
import { invoke } from "@forge/bridge";
import CopyButton from "./CopyButton";
import { isValidSlackWebhookUrl, isValidTeamsWebhookUrl } from "../utils/webhooks";

type Props = {
  config: any;
};

function StandupPreview({ config }: Props) {
  const [standup, setStandup] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasSlack = isValidSlackWebhookUrl(config?.slackWebhookUrl ?? "");
  const hasTeams = isValidTeamsWebhookUrl(config?.teamsWebhookUrl ?? "");
  const hasAnyChannel = hasSlack || hasTeams;

  const handleGenerate = async () => {
    setLoading(true);
    setStandup(null);
    setEdited(false);
    setSendResult(null);
    try {
      const result = await invoke<{ standup: string; displayName?: string }>("generateStandup", {
        sendToSlack: false,
      });
      setStandup(result.standup);
      setDisplayName(result.displayName || null);
    } catch (err: any) {
      setStandup(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  const handleSendNow = async () => {
    if (!standup) return;
    setSending(true);
    setSendResult(null);
    try {
      const result = await invoke<{ ok: boolean; error?: string }>(
        "sendEditedStandup",
        { text: standup }
      );
      setSendResult(result);
    } catch (err: any) {
      setSendResult({ ok: false, error: err.message });
    }
    setSending(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setStandup(e.target.value);
    setEdited(true);
    setSendResult(null);
  };

  const fitPreviewHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const cap = Math.round(window.innerHeight * 0.7);
    const minH = 300;
    const next = Math.min(Math.max(el.scrollHeight, minH), cap);
    el.style.height = `${next}px`;
  };

  useLayoutEffect(() => {
    if (!standup) return;
    fitPreviewHeight();
  }, [standup]);

  if (!standup && !loading) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#9998;</div>
        <h3>Generate a Standup Preview</h3>
        <p>
          Pull your latest Jira and GitHub activity and let AI write your standup.
          {!hasAnyChannel && " Set up Slack or Teams in Settings to enable posting."}
        </p>
        <Button appearance="primary" onClick={handleGenerate}>
          Generate Preview
        </Button>
        {hasAnyChannel && (
          <div className="channel-tags channel-tags--center" style={{ marginTop: 12 }}>
            <span>Will post to:</span>
            {hasSlack && <span className="channel-tag slack">Slack</span>}
            {hasTeams && <span className="channel-tag teams">Teams</span>}
            {hasSlack && !hasTeams && (
              <span className="channel-tag channel-tag--muted" title="Add in Settings">
                Teams not set
              </span>
            )}
            {hasTeams && !hasSlack && (
              <span className="channel-tag channel-tag--muted" title="Add in Settings">
                Slack not set
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 0" }}>
      <div className="toolbar">
        <Button
          appearance="primary"
          onClick={handleGenerate}
          isDisabled={loading}
        >
          Regenerate
        </Button>
        {standup && (
          <>
            <CopyButton text={standup} />
            {hasAnyChannel && (
              <Button
                appearance="warning"
                onClick={handleSendNow}
                isDisabled={sending}
              >
                {sending ? "Sending..." : "Send Now"}
              </Button>
            )}
          </>
        )}
        <div className="toolbar-spacer" />
        {edited && (
          <span className="status-badge neutral">Edited</span>
        )}
        {hasAnyChannel && (
          <div className="channel-tags">
            {hasSlack && <span className="channel-tag slack">Slack</span>}
            {hasTeams && <span className="channel-tag teams">Teams</span>}
            {hasSlack && !hasTeams && (
              <span className="channel-tag channel-tag--muted">Teams not set</span>
            )}
            {hasTeams && !hasSlack && (
              <span className="channel-tag channel-tag--muted">Slack not set</span>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-inline">
          <Spinner size="medium" />
          <span>Generating standup from your activity...</span>
        </div>
      )}

      {standup && (
        <div className="preview-message">
          <div className="preview-message-header">
            <span>
              {displayName
                ? `${displayName}'s Standup — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`
                : "Standup Preview"}
            </span>
            {edited && <span style={{ fontStyle: "italic" }}>Modified</span>}
          </div>
          <textarea
            ref={textareaRef}
            value={standup}
            onChange={handleTextChange}
            onInput={fitPreviewHeight}
            onFocus={fitPreviewHeight}
            className="preview-textarea"
          />
        </div>
      )}

      {standup && (
        <p className="form-hint">
          Edit the text above before sending. Changes are for this session only.
        </p>
      )}

      {sendResult && (
        <div style={{ marginTop: 12 }}>
          <SectionMessage
            appearance={sendResult.ok ? "success" : "error"}
          >
            <p>
              {sendResult.ok
                ? "Standup posted successfully!"
                : `Error: ${sendResult.error}`}
            </p>
          </SectionMessage>
        </div>
      )}
    </div>
  );
}

export default StandupPreview;
