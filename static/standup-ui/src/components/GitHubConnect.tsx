import React, { useState, useEffect, useCallback } from "react";
import Button from "@atlaskit/button/standard-button";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { invoke, router } from "@forge/bridge";

type GitHubStatus = {
  connected: boolean;
  username: string | null;
  githubOrgs?: string[];
  githubOrgOnly?: boolean;
};

type Props = {
  onConnectionChange?: () => void;
  githubOrgs?: string[];
  githubOrgOnly?: boolean;
  onFilterChange?: (orgs: string[], orgOnly: boolean) => void;
};

function GitHubConnect({ onConnectionChange, githubOrgs, githubOrgOnly, onFilterChange }: Props) {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgOnly, setOrgOnly] = useState(githubOrgOnly ?? false);
  const [orgsInput, setOrgsInput] = useState((githubOrgs || []).join(", "));

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
      <div className="loading-inline">
        <Spinner size="small" />
        <span>Checking GitHub connection...</span>
      </div>
    );
  }

  return (
    <div>
      {status?.connected ? (
        <div>
          <div className="github-connected">
            <span>&#10003;</span>
            <span>Connected as <strong>{status.username}</strong></span>
          </div>

          <div className="github-filters">
            <label>
              <input
                type="checkbox"
                checked={orgOnly}
                onChange={(e) => {
                  setOrgOnly(e.target.checked);
                  onFilterChange?.(
                    orgsInput.split(",").map((s) => s.trim()).filter(Boolean),
                    e.target.checked
                  );
                }}
              />
              <span>Only include organization repos (exclude personal)</span>
            </label>

            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">Filter to specific orgs</label>
              <input
                type="text"
                value={orgsInput}
                onChange={(e) => {
                  setOrgsInput(e.target.value);
                  onFilterChange?.(
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    orgOnly
                  );
                }}
                placeholder="e.g. hyperPad, my-company"
                className="form-input"
              />
              <p className="form-hint">
                Comma-separated. Leave empty to include all orgs.
              </p>
            </div>
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
              <p className="form-hint" style={{ marginBottom: 8 }}>
                Complete the authorization in the new tab, then click below.
              </p>
              <Button appearance="subtle" onClick={handleCheckConnection}>
                I've authorized -- check connection
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
