import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@forge/bridge";
import Spinner from "@atlaskit/spinner";
import SectionMessage from "@atlaskit/section-message";
import SettingsForm from "./components/SettingsForm";
import StandupPreview from "./components/StandupPreview";
import StandupHistory from "./components/StandupHistory";
import SetupWizard from "./components/SetupWizard";
import "./App.css";

type UserConfig = {
  enabled: boolean;
  slackWebhookUrl: string;
  teamsWebhookUrl?: string;
  slackBotToken?: string;
  slackChannelId?: string;
  slackTeamName?: string;
  slackConnected?: boolean;
  timezone: string;
  postingHour: number;
  skipWeekends: boolean;
  workDays?: number[];
  projects: string[] | "all";
  format: "bullets" | "prose";
  tone: "casual" | "professional";
  weeklyDigest?: boolean;
  customPrompt?: string;
  githubUsername?: string;
  githubToken?: string;
  githubConnected?: boolean;
  githubOrgs?: string[];
  githubOrgOnly?: boolean;
};

type TabId = "preview" | "settings" | "history";

const TABS: { id: TabId; label: string }[] = [
  { id: "preview", label: "Preview" },
  { id: "settings", label: "Settings" },
  { id: "history", label: "History" },
];

function App() {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("preview");

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await invoke<UserConfig>("getSettings");
      setConfig(settings);
      const hasSlack = settings.slackWebhookUrl || settings.slackConnected;
      if (!hasSlack && !settings.teamsWebhookUrl) {
        setShowWizard(true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveSettings = async (updates: Partial<UserConfig>) => {
    try {
      const result = await invoke<{
        success: boolean;
        config?: UserConfig;
        errors?: string[];
      }>("saveSettings", updates);

      if (!result.success) {
        throw new Error(result.errors?.join("\n") || "Failed to save settings");
      }

      if (result.config) setConfig(result.config);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
      throw err;
    }
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    loadSettings();
  };

  if (loading) {
    return (
      <div className="loading-center standup-app">
        <Spinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container standup-app">
        <SectionMessage appearance="error" title="Error">
          <p>{error}</p>
        </SectionMessage>
      </div>
    );
  }

  if (showWizard) {
    return (
      <SetupWizard
        onComplete={handleWizardComplete}
        onSave={handleSaveSettings}
      />
    );
  }

  return (
    <div className="app-container standup-app">
      <div className="app-header">
        <h1>Auto Standup Bot</h1>
        <p>AI-powered standups from your Jira and GitHub activity</p>
      </div>

      <div className="app-tab-bar" role="tablist" aria-label="App sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={activeTab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={activeTab === t.id ? 0 : -1}
            className={`app-tab ${activeTab === t.id ? "app-tab--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="app-tab-panel"
      >
        {activeTab === "preview" && <StandupPreview config={config} />}
        {activeTab === "settings" && config && (
          <SettingsForm config={config} onSave={handleSaveSettings} />
        )}
        {activeTab === "history" && <StandupHistory />}
      </div>
    </div>
  );
}

export default App;
