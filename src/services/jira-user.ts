import api, { route } from "@forge/api";
import { logger } from "../utils/logger";

export async function fetchUserDisplayName(accountId: string): Promise<string> {
  try {
    const response = await api
      .asApp()
      .requestJira(route`/rest/api/3/user?accountId=${accountId}`, {
        headers: { Accept: "application/json" },
      });

    if (response.ok) {
      const data = await response.json();
      return data.displayName || "Team Member";
    }
  } catch (error: any) {
    logger.warn("Failed to fetch user display name", {
      phase: "jira",
      accountId,
      error: error.message,
    });
  }
  return "Team Member";
}
