import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@forge/bridge";
import PageHeader from "@atlaskit/page-header";
import Tabs, { Tab, TabList, TabPanel } from "@atlaskit/tabs";
import Spinner from "@atlaskit/spinner";
import SectionMessage from "@atlaskit/section-message";
import SettingsForm from "./components/SettingsForm";
import StandupPreview from "./components/StandupPreview";
import StandupHistory from "./components/StandupHistory";
import SetupWizard from "./components/SetupWizard";

type UserConfig = {
  enabled: boolean;
  slackWebhookUrl: string;
  timezone: string;
  postingHour: number;
  skipWeekends: boolean;
  projects: string[] | "all";
  format: "bullets" | "prose";
  tone: "casual" | "professional";
};

function App() {
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await invoke<UserConfig>("getSettings");
      setConfig(settings);
      if (!settings.slackWebhookUrl) {
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
      const result = await invoke<{ success: boolean; config: UserConfig }>(
        "saveSettings",
        updates
      );
      if (result.success) {
        setConfig(result.config);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    }
  };

  const handleWizardComplete = () => {
    setShowWizard(false);
    loadSettings();
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <SectionMessage appearance="error" title="Error">
        <p>{error}</p>
      </SectionMessage>
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
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 24px" }}>
      <PageHeader>Auto Standup Bot</PageHeader>

      <Tabs id="standup-tabs">
        <TabList>
          <Tab>Preview</Tab>
          <Tab>Settings</Tab>
          <Tab>History</Tab>
        </TabList>

        <TabPanel>
          <StandupPreview />
        </TabPanel>

        <TabPanel>
          {config && (
            <SettingsForm config={config} onSave={handleSaveSettings} />
          )}
        </TabPanel>

        <TabPanel>
          <StandupHistory />
        </TabPanel>
      </Tabs>
    </div>
  );
}

export default App;
