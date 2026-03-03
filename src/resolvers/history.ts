import { storage } from "@forge/api";
import { StandupRecord } from "../types";

const HISTORY_LIMIT = 10;

export async function handleGetHistory(req: any) {
  const accountId: string = req.context.accountId;

  const records: Array<StandupRecord & { date: string }> = [];

  const today = new Date();
  for (let i = 0; i < HISTORY_LIMIT; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];

    const record = (await storage.get(
      `history:${accountId}:${dateKey}`
    )) as StandupRecord | undefined;

    if (record) {
      records.push({ ...record, date: dateKey });
    }
  }

  return { history: records };
}
