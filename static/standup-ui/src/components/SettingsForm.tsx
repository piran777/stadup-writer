import React, { useState } from "react";
import Button from "@atlaskit/button/standard-button";
import SectionMessage from "@atlaskit/section-message";
import SwitchToggle from "./SwitchToggle";
import SlackConfig from "./SlackConfig";
import TeamsConfig from "./TeamsConfig";
import GitHubConnect from "./GitHubConnect";

type UserConfig = {
  enabled: boolean;
  slackWebhookUrl: string;
  teamsWebhookUrl?: string;
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

const DAYS = [
  { day: "Sun", val: 0 },
  { day: "Mon", val: 1 },
  { day: "Tue", val: 2 },
  { day: "Wed", val: 3 },
  { day: "Thu", val: 4 },
  { day: "Fri", val: 5 },
  { day: "Sat", val: 6 },
];

function SettingsForm({ config, onSave }: Props) {
  const [form, setForm] = useState<UserConfig>({ ...config });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleChange = <K extends keyof UserConfig>(
    key: K,
    value: UserConfig[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSubmit = async () => {
    try {
      setSaveError(null);
      setSaving(true);
      await onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save settings");
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  const formatHour = (h: number) => {
    if (h === 0) return "12:00 AM";
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return "12:00 PM";
    return `${h - 12}:00 PM`;
  };

  const currentDays = form.workDays ?? [1, 2, 3, 4, 5];

  return (
    <div style={{ padding: "16px 0" }}>

      {/* ── Messaging ──────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h3>Messaging</h3>
          <p>Configure where your standups are posted</p>
        </div>
        <div className="card-body">
          <div className="form-group">
            <div className="toggle-row toggle-row--switch">
              <SwitchToggle
                checked={form.enabled}
                onChange={(v) => handleChange("enabled", v)}
                id="auto-post-toggle"
                aria-label="Auto-posting"
              />
              <label htmlFor="auto-post-toggle" className="toggle-label">
                Auto-posting {form.enabled ? "on" : "off"}
              </label>
            </div>
            <p className="form-hint">
              When on, standups post automatically at your scheduled time on working days.
            </p>
          </div>

          <hr className="section-divider" />

          <div className="form-group">
            <SlackConfig
              webhookUrl={form.slackWebhookUrl}
              onChange={(url) => handleChange("slackWebhookUrl", url)}
              onConnectionChange={() => {}}
            />
          </div>

          <div className="form-group">
            <TeamsConfig
              webhookUrl={form.teamsWebhookUrl || ""}
              onChange={(url) => handleChange("teamsWebhookUrl", url)}
            />
          </div>
        </div>
      </div>

      {/* ── Schedule ───────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h3>Schedule</h3>
          <p>Control when and how often standups are posted</p>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) => handleChange("timezone", e.target.value)}
              className="form-select"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Posting Hour</label>
            <select
              value={form.postingHour}
              onChange={(e) =>
                handleChange("postingHour", parseInt(e.target.value, 10))
              }
              className="form-select"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
            <p className="form-hint">
              Tip: Set this 1 hour before your desired delivery time for best results.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Working Days</label>
            <div className="day-picker">
              {DAYS.map(({ day, val }) => {
                const isActive = currentDays.includes(val);
                return (
                  <button
                    key={val}
                    type="button"
                    className={`day-btn ${isActive ? "active" : ""}`}
                    onClick={() => {
                      const updated = isActive
                        ? currentDays.filter((d) => d !== val)
                        : [...currentDays, val].sort();
                      handleChange("workDays", updated);
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <p className="form-hint">
              Standups only auto-post on selected days. The first workday after a break includes all prior activity.
            </p>
          </div>

          <div className="form-group">
            <div className="toggle-row toggle-row--switch">
              <SwitchToggle
                checked={form.weeklyDigest ?? false}
                onChange={(v) => handleChange("weeklyDigest", v)}
                id="weekly-digest-toggle"
                aria-label="Weekly digest on last work day"
              />
              <label htmlFor="weekly-digest-toggle" className="toggle-label-sm">
                Weekly digest on last work day
              </label>
            </div>
            <p className="form-hint">
              Posts a full week summary instead of a daily standup on the last working day.
            </p>
          </div>
        </div>
      </div>

      {/* ── AI Preferences ─────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h3>AI Preferences</h3>
          <p>Customize how your standup reads</p>
        </div>
        <div className="card-body">
          <div className="form-group">
            <label className="form-label">Format</label>
            <select
              value={form.format}
              onChange={(e) =>
                handleChange("format", e.target.value as "bullets" | "prose")
              }
              className="form-select"
            >
              <option value="bullets">Bullet Points</option>
              <option value="prose">Paragraphs</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tone</label>
            <select
              value={form.tone}
              onChange={(e) =>
                handleChange("tone", e.target.value as "casual" | "professional")
              }
              className="form-select"
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Custom AI Instructions</label>
            <p className="webhook-hint">
              Optional. Tell the AI how to write your standups (e.g. "Write from a PM
              perspective", "Include emojis", "Keep it under 3 bullets").
            </p>
            <textarea
              value={form.customPrompt || ""}
              onChange={(e) => handleChange("customPrompt", e.target.value)}
              placeholder='e.g. "Write like a senior engineer. Be very concise."'
              rows={3}
              className="form-textarea"
            />
          </div>
        </div>
      </div>

      {/* ── GitHub Integration ─────────────────── */}
      <div className="card">
        <div className="card-header">
          <h3>GitHub Integration</h3>
          <p>Include commits and pull requests in your standup</p>
        </div>
        <div className="card-body">
          <GitHubConnect
            githubOrgs={form.githubOrgs}
            githubOrgOnly={form.githubOrgOnly}
            onFilterChange={(orgs, orgOnlyVal) => {
              handleChange("githubOrgs", orgs);
              handleChange("githubOrgOnly", orgOnlyVal);
            }}
          />
        </div>
      </div>

      {/* ── Save ───────────────────────────────── */}
      <div className="save-bar">
        <div className="save-actions">
          <Button
            appearance="primary"
            onClick={handleSubmit}
            isDisabled={saving}
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
        <div className="save-feedback" aria-live="polite">
          {saved && (
            <SectionMessage appearance="success">
              <p>Settings saved.</p>
            </SectionMessage>
          )}
          {saveError && (
            <SectionMessage appearance="error" title="Could not save">
              <p>{saveError}</p>
            </SectionMessage>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsForm;
