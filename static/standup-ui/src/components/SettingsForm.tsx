import React, { useState } from "react";
import Button from "@atlaskit/button/standard-button";
import Toggle from "@atlaskit/toggle";
import SectionMessage from "@atlaskit/section-message";
import SlackConfig from "./SlackConfig";
import GitHubConnect from "./GitHubConnect";

type UserConfig = {
  enabled: boolean;
  slackWebhookUrl: string;
  timezone: string;
  postingHour: number;
  skipWeekends: boolean;
  projects: string[] | "all";
  format: "bullets" | "prose";
  tone: "casual" | "professional";
  githubUsername?: string;
  githubToken?: string;
  githubConnected?: boolean;
  githubOrgs?: string[];
  githubOrgOnly?: boolean;
};

type Props = {
  config: UserConfig;
  onSave: (updates: Partial<UserConfig>) => Promise<void>;
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

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function SettingsForm({ config, onSave }: Props) {
  const [form, setForm] = useState<UserConfig>({ ...config });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = <K extends keyof UserConfig>(
    key: K,
    value: UserConfig[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSubmit = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const formatHour = (h: number) => {
    if (h === 0) return "12:00 AM";
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return "12:00 PM";
    return `${h - 12}:00 PM`;
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 3,
    border: "1px solid #dfe1e6",
    fontSize: 14,
    marginBottom: 16,
  };

  return (
    <div style={{ padding: "16px 0", maxWidth: 480 }}>
      <div style={{ marginBottom: 24 }}>
        <label
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <Toggle
            isChecked={form.enabled}
            onChange={() => handleChange("enabled", !form.enabled)}
          />
          <span style={{ fontWeight: 600 }}>
            Auto-posting {form.enabled ? "enabled" : "disabled"}
          </span>
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SlackConfig
          webhookUrl={form.slackWebhookUrl}
          onChange={(url) => handleChange("slackWebhookUrl", url)}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 500, display: "block", marginBottom: 4 }}>
          Timezone
        </label>
        <select
          value={form.timezone}
          onChange={(e) => handleChange("timezone", e.target.value)}
          style={selectStyle}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 500, display: "block", marginBottom: 4 }}>
          Posting Hour
        </label>
        <select
          value={form.postingHour}
          onChange={(e) =>
            handleChange("postingHour", parseInt(e.target.value, 10))
          }
          style={selectStyle}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {formatHour(h)}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 11, color: "#97A0AF", margin: "-12px 0 12px" }}>
          Tip: Set this 1 hour before your desired delivery time for best results.
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 500, display: "block", marginBottom: 4 }}>
          Format
        </label>
        <select
          value={form.format}
          onChange={(e) =>
            handleChange("format", e.target.value as "bullets" | "prose")
          }
          style={selectStyle}
        >
          <option value="bullets">Bullet Points</option>
          <option value="prose">Paragraphs</option>
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 500, display: "block", marginBottom: 4 }}>
          Tone
        </label>
        <select
          value={form.tone}
          onChange={(e) =>
            handleChange("tone", e.target.value as "casual" | "professional")
          }
          style={selectStyle}
        >
          <option value="professional">Professional</option>
          <option value="casual">Casual</option>
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <Toggle
            isChecked={form.skipWeekends}
            onChange={() =>
              handleChange("skipWeekends", !form.skipWeekends)
            }
          />
          <span>Skip weekends</span>
        </label>
      </div>

      <div style={{ marginBottom: 24 }}>
        <GitHubConnect
          githubOrgs={form.githubOrgs}
          githubOrgOnly={form.githubOrgOnly}
          onFilterChange={(orgs, orgOnlyVal) => {
            handleChange("githubOrgs", orgs.length > 0 ? orgs : undefined);
            handleChange("githubOrgOnly", orgOnlyVal || undefined);
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Button
          appearance="primary"
          onClick={handleSubmit}
          isDisabled={saving}
        >
          Save Settings
        </Button>
        {saved && (
          <SectionMessage appearance="success">
            <p>Settings saved.</p>
          </SectionMessage>
        )}
      </div>
    </div>
  );
}

export default SettingsForm;
