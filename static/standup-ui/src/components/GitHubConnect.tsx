import React, { useState, useEffect, useCallback } from "react";
import Button from "@atlaskit/button/standard-button";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { invoke, router } from "@forge/bridge";

type GitHubStatus = {
  connected: boolean;
  username: string | null;
};

type Props = {
  onConnectionChange?: () => void;
};

function GitHubConnect({ onConnectionChange }: Props) {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await invoke<GitHubStatus>("getGitHubStatus");
      setStatus(result);
    } catch {
      setStatus({ connected: false, username: null });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCheckConnection = async () => {
    setLoading(true);
    await fetchStatus();
    setConnecting(false);
    setLoading(false);
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const result = await invoke<{ ok: boolean; url?: string; error?: string }>(
        "getGitHubAuthUrl"
      );
      if (result.ok && result.url) {
        await router.open(result.url);
      } else {
        setError(result.error || "Failed to start GitHub connection");
        setConnecting(false);
      }
    } catch (err: any) {
      setError(err.message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await invoke("disconnectGitHub");
      setStatus({ connected: false, username: null });
      onConnectionChange?.();
    } catch (err: any) {
      setError(err.message);
    }
    setDisconnecting(false);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
        <Spinner size="small" />
        <span style={{ fontSize: 13, color: "#6B778C" }}>Checking GitHub connection...</span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        background: "#f4f5f7",
        borderRadius: 8,
        border: "1px solid #dfe1e6",
      }}
    >
      <h4 style={{ margin: "0 0 4px", fontWeight: 600 }}>
        GitHub Integration
        <span style={{ fontWeight: 400, fontSize: 12, color: "#6B778C", marginLeft: 8 }}>
          Optional
        </span>
      </h4>
      <p style={{ fontSize: 12, color: "#6B778C", margin: "0 0 12px" }}>
        Connect GitHub to include commits and pull requests in your standup.
      </p>

      {status?.connected ? (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "#E3FCEF",
              borderRadius: 4,
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 16 }}>&#10003;</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#006644" }}>
              Connected as <strong>{status.username}</strong>
            </span>
          </div>
          <Button
            appearance="subtle"
            onClick={handleDisconnect}
            isDisabled={disconnecting}
          >
            {disconnecting ? "Disconnecting..." : "Disconnect GitHub"}
          </Button>
        </div>
      ) : (
        <div>
          <Button
            appearance="primary"
            onClick={handleConnect}
            isDisabled={connecting}
          >
            {connecting ? "Waiting for authorization..." : "Connect GitHub"}
          </Button>
          {connecting && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 12, color: "#6B778C", margin: "0 0 8px" }}>
                Complete the authorization in the new tab, then click below.
              </p>
              <Button appearance="subtle" onClick={handleCheckConnection}>
                I've authorized — check connection
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12 }}>
          <SectionMessage appearance="error">
            <p>{error}</p>
          </SectionMessage>
        </div>
      )}
    </div>
  );
}

export default GitHubConnect;
