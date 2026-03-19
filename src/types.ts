export type UserActivity = {
  completed: Array<{
    key: string;
    summary: string;
    from: string;
    to: string;
  }>;
  inProgress: Array<{
    key: string;
    summary: string;
  }>;
  commented: Array<{
    key: string;
    summary: string;
    commentSnippet: string;
  }>;
  blocked: Array<{
    key: string;
    summary: string;
  }>;
};

export type GitHubCommit = {
  repo: string;
  message: string;
  sha: string;
  linkedTicket?: string;
};

export type GitHubPR = {
  repo: string;
  title: string;
  number: number;
  action: "opened" | "merged" | "closed" | "reviewed";
  linkedTicket?: string;
};

export type GitHubActivity = {
  commits: GitHubCommit[];
  pullRequests: GitHubPR[];
};

export type CombinedActivity = {
  jira: UserActivity;
  github: GitHubActivity;
};

export type UserConfig = {
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
};

export type StandupRecord = {
  generatedAt: string;
  postedToSlack: boolean;
  content: string;
  activity: UserActivity;
};
