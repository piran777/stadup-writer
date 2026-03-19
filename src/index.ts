import Resolver from "@forge/resolver";
import { handleGenerateStandup, handleSendEditedStandup } from "./resolvers/generate-standup";
import { handleGetSettings, handleSaveSettings, handleTestWebhook } from "./resolvers/settings";
import { handleGetHistory } from "./resolvers/history";
import { runHourlyCheck } from "./scheduler/hourly-check";

const resolver = new Resolver();

resolver.define("generateStandup", handleGenerateStandup);
resolver.define("getSettings", handleGetSettings);
resolver.define("saveSettings", handleSaveSettings);
resolver.define("getHistory", handleGetHistory);
resolver.define("testWebhook", handleTestWebhook);
resolver.define("sendEditedStandup", handleSendEditedStandup);

export const handler = resolver.getDefinitions();

export const scheduledHandler = async () => {
  await runHourlyCheck();
};
