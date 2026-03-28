import React, { useEffect, useState } from "react";
import Spinner from "@atlaskit/spinner";
import { invoke } from "@forge/bridge";
import CopyButton from "./CopyButton";

type HistoryRecord = {
  date: string;
  generatedAt: string;
  postedToSlack: boolean;
  content: string;
};

function StandupHistory() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const result = await invoke<{ history: HistoryRecord[] }>(
          "getHistory"
        );
        setHistory(result.history);
        if (result.history.length > 0) {
          setExpandedDates(new Set([result.history[0].date]));
        }
      } catch {
        setHistory([]);
      }
      setLoading(false);
    })();
  }, []);

  const toggleExpand = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="loading-center">
        <Spinner size="medium" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#128203;</div>
        <h3>No History Yet</h3>
        <p>
          Generate your first standup from the Preview tab. Past standups will appear here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 0" }}>
      {history.map((record) => {
        const isExpanded = expandedDates.has(record.date);
        return (
          <div key={record.date} className="history-card">
            <div
              className="history-card-header"
              onClick={() => toggleExpand(record.date)}
              style={{ cursor: "pointer" }}
            >
              <strong>{record.date}</strong>
              <div className="btn-group">
                <span className={`status-badge ${record.postedToSlack ? "success" : "neutral"}`}>
                  {record.postedToSlack ? "Posted" : "Not posted"}
                </span>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>
            </div>
            <div className={`history-card-body ${isExpanded ? "" : "collapsed"}`}>
              {record.content}
            </div>
            {isExpanded && (
              <div className="history-card-actions">
                <CopyButton text={record.content} label="Copy" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default StandupHistory;
