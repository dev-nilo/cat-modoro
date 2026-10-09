/**
 * Session history, local-first.
 *
 * The timer never waits on the network. When a phase ends we build a session
 * record and put it in an outbox in localStorage; `flushOutbox` then POSTs it
 * to the API in the background and keeps it queued while offline. Each record
 * carries a client-generated id, so a retry after a lost response is harmless.
 *
 * The device is identified by an anonymous UUID (X-Client-Id). Anyone with it
 * can read this device's history, so it's never shown in the UI.
 */

import type { NewSession, Session, SessionPage } from "@/server/sessions/schemas";

import { FOCUS, LONG_BREAK, type Phase, type TimerState } from "./timer";

export const CLIENT_ID_KEY = "cat-modoro:client-id";
export const HISTORY_KEY = "cat-modoro:history:v1";
export const API_BASE = "/api/v1/sessions";
/** Oldest records are dropped beyond this, so a device that never syncs can't fill the quota. */
export const OUTBOX_LIMIT = 500;

export type { NewSession, Session, SessionPage };

/** The phase that's under way, so its record can say when it started. */
export interface PhaseRun {
  phase: Phase;
  startedAt: number; // epoch ms
}

export interface HistoryState {
  current: PhaseRun | null;
  outbox: NewSession[];
}

export const emptyHistory = (): HistoryState => ({ current: null, outbox: [] });

export function kindOf(phase: Phase): NewSession["kind"] {
  return phase === FOCUS ? "focus" : phase === LONG_BREAK ? "long_break" : "short_break";
}

/**
 * Follows the timer: a phase starts the first time it runs. A phase back at
 * its full length and not running (after a reset or a new day) never started.
 */
export function observe(h: HistoryState, timer: TimerState, fresh: boolean, now: number): HistoryState {
  if (timer.running) {
    if (h.current?.phase === timer.phase) return h;
    return { ...h, current: { phase: timer.phase, startedAt: now } };
  }
  if (fresh && h.current) return { ...h, current: null };
  return h;
}

export interface PhaseEnd {
  phase: Phase;
  outcome: NewSession["outcome"];
  endedAt: number;
  plannedSeconds: number;
}

/** Closes the current phase and queues its record. A phase that never ran isn't a session. */
export function finish(h: HistoryState, end: PhaseEnd, id: string): HistoryState {
  const run = h.current;
  if (!run || run.phase !== end.phase) return { ...h, current: null };
  const record: NewSession = {
    id,
    kind: kindOf(end.phase),
    outcome: end.outcome,
    startedAt: new Date(run.startedAt).toISOString(),
    endedAt: new Date(Math.max(end.endedAt, run.startedAt)).toISOString(),
    plannedSeconds: Math.round(end.plannedSeconds),
  };
  return { current: null, outbox: [...h.outbox, record].slice(-OUTBOX_LIMIT) };
}

export function parseHistory(raw: string | null): HistoryState {
  try {
    const data = JSON.parse(raw ?? "");
    const current =
      data?.current && typeof data.current.phase === "string" && typeof data.current.startedAt === "number"
        ? (data.current as PhaseRun)
        : null;
    const outbox = Array.isArray(data?.outbox) ? (data.outbox as NewSession[]) : [];
    return { current, outbox };
  } catch {
    return emptyHistory();
  }
}

// --- storage ---------------------------------------------------------------

export function loadHistory(): HistoryState {
  try {
    return parseHistory(window.localStorage.getItem(HISTORY_KEY));
  } catch {
    return emptyHistory();
  }
}

export function writeHistory(h: HistoryState): void {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch {
    // Private mode / quota: history just won't be kept.
  }
}

export function clientId(): string {
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    // Without storage every visit is a new, empty history.
    return crypto.randomUUID();
  }
}

// --- network ---------------------------------------------------------------

type Fetch = typeof fetch;

/**
 * Sends queued records oldest first. Stops at the first transient failure
 * (offline, 429, 5xx) and keeps the rest for later. A 4xx other than 429 will
 * never succeed, so that record is dropped. Returns the records still queued.
 */
export async function flushOutbox(outbox: NewSession[], client: string, fetchImpl: Fetch = fetch): Promise<NewSession[]> {
  let i = 0;
  for (; i < outbox.length; i++) {
    let res: Response;
    try {
      res = await fetchImpl(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Client-Id": client },
        body: JSON.stringify(outbox[i]),
      });
    } catch {
      break;
    }
    if (res.ok) continue;
    if (res.status === 429 || res.status >= 500) break;
    console.warn(`Dropping session ${outbox[i].id}: the API answered ${res.status}.`);
  }
  return outbox.slice(i);
}

export async function fetchSessions(page: number, size = 20, fetchImpl: Fetch = fetch): Promise<SessionPage> {
  const res = await fetchImpl(`${API_BASE}?page=${page}&size=${size}`, { headers: { "X-Client-Id": clientId() } });
  if (!res.ok) throw new Error(`GET ${API_BASE} failed with ${res.status}`);
  return res.json();
}

export async function removeSession(id: string, fetchImpl: Fetch = fetch): Promise<void> {
  const res = await fetchImpl(`${API_BASE}/${id}`, { method: "DELETE", headers: { "X-Client-Id": clientId() } });
  // Already gone counts as deleted.
  if (!res.ok && res.status !== 404) throw new Error(`DELETE failed with ${res.status}`);
}
