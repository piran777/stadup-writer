type LogLevel = "info" | "warn" | "error";

type LogContext = {
  accountId?: string;
  phase?: string;
  [key: string]: any;
};

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  switch (level) {
    case "error":
      console.error(JSON.stringify(entry));
      break;
    case "warn":
      console.warn(JSON.stringify(entry));
      break;
    default:
      console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),

  schedulerRun: (totalUsers: number, processedUsers: number, skippedUsers: number) =>
    log("info", "Scheduler run complete", {
      phase: "scheduler",
      totalUsers,
      processedUsers,
      skippedUsers,
    }),

  standupGenerated: (accountId: string, postedToSlack: boolean) =>
    log("info", "Standup generated", {
      phase: "standup",
      accountId,
      postedToSlack,
    }),

  standupSkipped: (accountId: string, reason: string) =>
    log("info", "Standup skipped", {
      phase: "standup",
      accountId,
      reason,
    }),
};
