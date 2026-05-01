import React, { useState, useEffect, useCallback } from "react";
import Button from "@atlaskit/button/standard-button";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { invoke, router } from "@forge/bridge";

type SlackStatus = {
  connected: boolean;
  teamName: string | null;
  channelId: string | null;
  channelName: string | null;
};

type SlackChannel = {
  id: string;
  name: string;
  isPrivate: boolean;
};

type Props = {
  onConnectionChange?: (connected: boolean) => void;
};

function SlackConnect({ onConnectionChange }: Props) {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [savingChannel, setSavingChannel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await invoke<SlackStatus>("getSlackStatus");
      setStatus(result);
      if (result.channelId) {
        setSelectedChannel(result.channelId);
      }
      return result;
    } catch {
      setStatus({ connected: false, teamName: null, channelId: null, channelName: null });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus().then((result) => {
      if (result?.connected && !result.channelId) {
        fetchChannels();
      }
    });
  }, [fetchStatus]);

  const fetchChannels = async () => {
    setLoadingChannels(true);
    try {
      const result = await invoke<{ ok: boolean; channels: SlackChannel[]; error?: string }>(
        "getSlackChannels"
      );
      if (result.ok) {
        setChannels(result.channels);
      } else {
        setError(result.error || "Failed to load channels");
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoadingChannels(false);
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const result = await invoke<{ ok: boolean; url?: string; error?: string }>(
        "getSlackAuthUrl"
      );
      if (result.ok && result.url) {
        await router.open(result.url);
      } else {
        setError(result.error || "Failed to start Slack connection");
        setConnecting(false);
      }
    } catch (err: any) {
      setError(err.message);
      setConnecting(false);
    }
  };

  const handleCheckConnection = async () => {
    setLoading(true);
    const result = await fetchStatus();
    setConnecting(false);
    setLoading(false);
    if (result?.connected) {
      await fetchChannels();
      onConnectionChange?.(true);
    } else {
      setError("Slack connection not found. Please try authorizing again.");
      onConnectionChange?.(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await invoke("disconnectSlack");
      setStatus({ connected: false, teamName: null, channelId: null, channelName: null });
      setChannels([]);
      setSelectedChannel("");
      onConnectionChange?.(false);
    } catch (err: any) {
      setError(err.message);
    }
    setDisconnecting(false);
  };

  const handleSaveChannel = async () => {
    if (!selectedChannel) return;
    setSavingChannel(true);
    setError(null);
    try {
      const result = await invoke<{ ok: boolean; error?: string }>("setSlackChannel", {
        channelId: selectedChannel,
      });
      if (result.ok) {
        const ch = channels.find((c) => c.id === selectedChannel);
        setStatus((prev) =>
          prev ? { ...prev, channelId: selectedChannel, channelName: ch?.name || null } : prev
        );
        onConnectionChange?.(true);
      } else {
        setError(result.error || "Failed to save channel");
      }
    } catch (err: any) {
      setError(err.message);
    }
    setSavingChannel(false);
  };

  if (loading) {
    return (
      <div className="loading-inline">
        <Spinner size="small" />
        <span>Checking Slack connection...</span>
      </div>
    );
  }

  return (
    <div>
      {status?.connected ? (
        <div>
          <div className="github-connected">
            <span>&#10003;</span>
            <span>
              Connected to <strong>{status.teamName || "Slack"}</strong>
            </span>
          </div>

          {status.channelId ? (
            <div style={{ margin: "8px 0" }}>
              <span className="channel-tag slack">
                #{channels.find((c) => c.id === status.channelId)?.name || status.channelId}
              </span>
              <Button
                appearance="subtle"
                onClick={fetchChannels}
                isDisabled={loadingChannels}
                spacing="compact"
              >
                Change channel
              </Button>
            </div>
          ) : (
            <div style={{ margin: "8px 0" }}>
              <p className="form-hint">Select a channel for standup messages:</p>
            </div>
          )}

          {(channels.length > 0 || loadingChannels || !status.channelId) && (
            <div style={{ margin: "8px 0" }}>
              {loadingChannels ? (
                <div className="loading-inline">
                  <Spinner size="small" />
                  <span>Loading channels...</span>
                </div>
              ) : channels.length > 0 ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="form-input"
                    style={{ flex: 1 }}
                  >
                    <option value="">Select a channel...</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.isPrivate ? "🔒 " : "#"}{ch.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    appearance="primary"
                    onClick={handleSaveChannel}
                    isDisabled={!selectedChannel || savingChannel}
                    spacing="compact"
                  >
                    {savingChannel ? "Saving..." : "Save"}
                  </Button>
                </div>
              ) : !status.channelId ? (
                <Button appearance="primary" onClick={fetchChannels} spacing="compact">
                  Select channel
                </Button>
              ) : null}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <Button
              appearance="subtle"
              onClick={handleDisconnect}
              isDisabled={disconnecting}
            >
              {disconnecting ? "Disconnecting..." : "Disconnect Slack"}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            appearance="primary"
            onClick={handleConnect}
            isDisabled={connecting}
          >
            {connecting ? "Waiting for authorization..." : "Connect to Slack"}
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
          <p className="form-hint" style={{ marginTop: 8 }}>
            One click to connect. No webhook URL needed.
          </p>
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

export default SlackConnect;
