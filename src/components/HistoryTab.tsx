"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchSessions, loadHistory, removeSession, type Session } from "@/lib/history";
import { dayKey } from "@/lib/storage";

const PAGE_SIZE = 20;

const KIND_LABELS: Record<Session["kind"], string> = {
  focus: "Focus",
  short_break: "Break",
  long_break: "Long break",
};

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });

function duration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

const elapsed = (s: Session) => Date.parse(s.endedAt) - Date.parse(s.startedAt);

/** Groups sessions (already newest first) by local day. */
function byDay(sessions: Session[]) {
  const days = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = dayKey(Date.parse(s.startedAt));
    days.set(key, [...(days.get(key) ?? []), s]);
  }
  return [...days.values()];
}

type Status = "loading" | "idle" | "error";

export default function HistoryTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [pending] = useState(() => loadHistory().outbox.length);

  const load = useCallback(async (next: number) => {
    setStatus("loading");
    try {
      const result = await fetchSessions(next, PAGE_SIZE);
      setSessions((prev) => (next === 0 ? result.content : [...prev, ...result.content]));
      setTotal(result.page.totalElements);
      setPage(next);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load(0);
  }, [load]);

  const remove = async (id: string) => {
    try {
      await removeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setTotal((t) => t - 1);
    } catch {
      setStatus("error");
    }
  };

  const hasMore = sessions.length < total;

  return (
    <div className="tab-panel">
      {pending > 0 && (
        <p className="hint-text">
          {pending} session{pending === 1 ? "" : "s"} waiting to sync. They&apos;ll show up once you&apos;re online.
        </p>
      )}

      {status !== "loading" && sessions.length === 0 && status !== "error" && (
        <p className="hint-text">No sessions yet. Finish (or skip) a focus session and it&apos;ll show up here.</p>
      )}

      {byDay(sessions).map((day) => {
        const focus = day.filter((s) => s.kind === "focus" && s.outcome === "completed");
        return (
          <section key={day[0].startedAt} className="history-day" aria-label={dayFormat.format(new Date(day[0].startedAt))}>
            <h3 className="history-day-title">
              <span>{dayFormat.format(new Date(day[0].startedAt))}</span>
              <span className="history-day-total">
                {focus.length} focus · {duration(focus.reduce((sum, s) => sum + elapsed(s), 0))}
              </span>
            </h3>
            <ul className="history-list">
              {day.map((s) => (
                <li key={s.id} className={`history-item history-${s.kind}`}>
                  <span className="history-kind">{KIND_LABELS[s.kind]}</span>
                  <span className="history-time">
                    {timeFormat.format(new Date(s.startedAt))}–{timeFormat.format(new Date(s.endedAt))}
                  </span>
                  <span className="history-length">
                    {duration(elapsed(s))}
                    {s.outcome === "skipped" && <span className="history-skipped"> · skipped</span>}
                  </span>
                  <button
                    type="button"
                    className="history-delete"
                    onClick={() => void remove(s.id)}
                    aria-label={`Delete ${KIND_LABELS[s.kind]} at ${timeFormat.format(new Date(s.startedAt))}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {status === "loading" && <p className="hint-text" aria-busy>Loading…</p>}
      {status === "error" && (
        <p className="hint-text hint-warn" role="alert">
          Couldn&apos;t reach the history.{" "}
          <button type="button" className="link-button" onClick={() => void load(sessions.length ? page + 1 : 0)}>
            Try again
          </button>
        </p>
      )}
      {status === "idle" && hasMore && (
        <button type="button" className="btn" onClick={() => void load(page + 1)}>
          Load more
        </button>
      )}
    </div>
  );
}
