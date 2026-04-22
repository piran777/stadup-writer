# Auto Standup Bot

AI-powered standups from your Jira and GitHub activity, delivered to Slack or Microsoft Teams.

Auto Standup Bot is an [Atlassian Forge](https://developer.atlassian.com/platform/forge/) app for Jira Cloud. It reads your recent Jira activity (and optional GitHub commits/PRs), generates a clean standup using AI, and posts it to your team's Slack or Teams channel — on a schedule or on demand.

---

## Features

- **AI-generated standups** from Jira issues assigned to you (status changes, comments, completions, blockers).
- **GitHub integration** (optional) — include commits and pull requests via GitHub OAuth.
- **Slack + Microsoft Teams delivery** via incoming webhooks, with a built-in Test button.
- **Scheduled auto-posting** — set your timezone, posting hour, and working days; standups post automatically.
- **Working-day logic** — the first workday after a break rolls in all prior activity since your last working day.
- **Weekly digest** — optionally post a full-week summary on your last working day instead of a daily standup.
- **Preview & edit** — generate a standup on demand, edit it, then Copy or Send Now.
- **History** — view and copy previous standups.
- **AI customization** — choose tone (casual / professional), format (bullets / prose), and add custom instructions.

---

## Getting Started

### 1. Install the app

Install **Auto Standup Bot** from the [Atlassian Marketplace](https://marketplace.atlassian.com) into your Jira Cloud site.

### 2. Open the app

In Jira, navigate to **Apps → Auto Standup Bot** (or find it in the global navigation).

### 3. Add a webhook

On the **Settings** tab, paste a Slack or Microsoft Teams incoming webhook URL:

- **Slack**: Go to [api.slack.com/apps](https://api.slack.com/apps) → your app → Incoming Webhooks → Add to Channel. Copy the webhook URL.
- **Microsoft Teams**: Go to channel settings → Connectors → Incoming Webhook (or use [Workflows / Power Automate](https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook) for newer Teams tenants). Copy the webhook URL.

Click **Test** to verify the webhook works.

> **Note:** Some organizations restrict incoming webhooks or connectors. If you cannot create one, contact your Slack/Teams admin. You can always use the **Copy** button in the Preview tab as a fallback.

### 4. Configure your schedule

- **Timezone** — select your local timezone.
- **Posting hour** — when to auto-post (tip: set 1 hour before your desired delivery time).
- **Working days** — choose which days standups should auto-post. The first workday after a break includes all activity since your last working day.
- **Weekly digest** (optional) — toggle on to post a full-week summary on your last working day.

### 5. Customize AI output

- **Format**: Bullet Points or Paragraphs.
- **Tone**: Professional or Casual.
- **Custom AI instructions** (optional): e.g. "Write from a PM perspective", "Include emojis", "Keep it under 3 bullets".

### 6. Connect GitHub (optional)

Click **Connect GitHub** in the GitHub Integration card. Authorize the app via GitHub OAuth. Once connected, your recent commits and pull requests will be included in generated standups.

You can filter to specific GitHub organizations or exclude personal repos.

### 7. Save settings

Click **Save Settings** to persist your configuration.

---

## Using the App

### Preview Tab

- Click **Regenerate** to create a fresh standup from your latest Jira (and GitHub) activity.
- **Edit** the generated text directly in the preview area.
- Click **Copy** to copy to clipboard, or **Send Now** to post to your configured Slack/Teams channels.
- Preview is manual and separate from scheduled auto-posting.

### Settings Tab

- Configure messaging (Slack/Teams webhooks), schedule, AI preferences, and GitHub integration.
- All changes require clicking **Save Settings**.

### History Tab

- View previously generated standups by date.
- Expand/collapse entries and copy past standups.

---

## How It Works

1. **Jira activity**: The app searches for Jira issues assigned to you (`assignee = currentUser()`) updated within the lookback window. It reads issue summaries, status transitions, and your comments.
2. **GitHub activity** (optional): If connected, the app fetches your recent push events and pull request activity from the GitHub Events API.
3. **AI generation**: Activity is sent to OpenAI to produce a structured standup (Yesterday / Today / Blockers).
4. **Delivery**: The standup is posted to your configured Slack and/or Teams webhook(s), or you can copy/send manually from the Preview tab.
5. **Scheduling**: A Forge scheduled trigger runs hourly. If it matches your configured posting hour + timezone + working day, it auto-generates and posts your standup.

---

## Data & Privacy

- **Jira data access** is limited to issues assigned to the authenticated user. The app uses `read:jira-work` and `read:jira-user` scopes only.
- **No customer data is stored on external servers.** All configuration and standup history is stored in Atlassian Forge app storage.
- **Sensitive values** (Slack webhook URLs, GitHub OAuth tokens) are stored using Forge encrypted secret storage (`storage.setSecret`).
- **Outbound network calls** are restricted to an explicit allowlist in the Forge manifest: `api.openai.com`, `hooks.slack.com`, `api.github.com`, `github.com`, and Microsoft Teams webhook domains (`*.webhook.office.com`, `*.office.com`, `*.office365.com`).
- See our [Privacy Policy](docs/privacy-policy.html) and [Terms of Service](docs/terms-of-service.html) for more details.

---

## Permissions

| Scope | Why |
|---|---|
| `read:jira-work` | Read issues, statuses, comments, and changelogs assigned to the user |
| `read:jira-user` | Identify the current user (account ID, display name) to scope activity |
| `storage:app` | Store user configuration, standup history, and encrypted secrets |

---

## Troubleshooting

### Webhook test fails

- **401/403**: Your organization may block incoming webhooks. Ask your Slack/Teams admin to allow them.
- **404**: The webhook may be disabled or revoked. Create a new one and update Settings.
- **Network/timeout error**: Your network or firewall may block outbound requests. Try a different network or ask IT.

### GitHub "GITHUB_CLIENT_ID not configured"

Environment variables (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) must be set for the Forge environment you are using. See [Forge environment variables](https://developer.atlassian.com/platform/forge/environments/#environment-variables).

### "Invalid or expired OAuth state" on GitHub connect

This usually means the GitHub OAuth callback URL does not match the Forge webtrigger URL for the current environment. Ensure `GITHUB_REDIRECT_URI` matches the webtrigger URL and that the same URL is registered in your GitHub OAuth app settings.

### No standup generated / empty standup

- Verify you have Jira issues **assigned to you** that were **updated** in the last 24 hours.
- Check that your timezone and posting hour are set correctly.

---

## Support

For help, bug reports, or feature requests:

- [GitHub Issues](https://github.com/piran777/stadup-writer/issues)

---

## License

Commercial — no charge. See [Terms of Service](docs/terms-of-service.html).
