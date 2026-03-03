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

export type UserConfig = {
  enabled: boolean;
  slackWebhookUrl: string;
  timezone: string;
  postingHour: number;
  skipWeekends: boolean;
  projects: string[] | "all";
  format: "bullets" | "prose";
  tone: "casual" | "professional";
};

export type StandupRecord = {
  generatedAt: string;
  postedToSlack: boolean;
  content: string;
  activity: UserActivity;
};
