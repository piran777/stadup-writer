import React, { useEffect, useState } from "react";
import Spinner from "@atlaskit/spinner";
import SectionMessage from "@atlaskit/section-message";
import { invoke } from "@forge/bridge";

type HistoryRecord = {
  date: string;
  generatedAt: string;
  postedToSlack: boolean;
  content: string;
};

function StandupHistory() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await invoke<{ history: HistoryRecord[] }>(
          "getHistory"
        );
        setHistory(result.history);
      } catch {
        setHistory([]);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Spinner size="medium" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div style={{ padding: "16px 0" }}>
        <SectionMessage>
          <p>No standup history yet. Generate your first standup from the Preview tab.</p>
        </SectionMessage>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 0" }}>
      {history.map((record) => (
        <div
          key={record.date}
          style={{
            marginBottom: 16,
            border: "1px solid #dfe1e6",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "#f4f5f7",
              padding: "8px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #dfe1e6",
            }}
          >
            <strong>{record.date}</strong>
            <span
              style={{
                fontSize: 12,
                color: record.postedToSlack ? "#36B37E" : "#6b778c",
              }}
            >
              {record.postedToSlack ? "Posted to Slack" : "Not posted"}
            </span>
          </div>
          <div
            style={{
              padding: 16,
              whiteSpace: "pre-wrap",
              fontFamily: "monospace",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {record.content}
          </div>
        </div>
      ))}
    </div>
  );
}

export default StandupHistory;
