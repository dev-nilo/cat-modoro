/**
 * Persistence: one versioned JSON blob in localStorage.
 *
 * The timer keeps running while the tab is closed: on load we fast-forward it
 * by the wall-clock time since the last save. Cycles and energy belong to a
 * day and reset at local midnight — but a phase that's running when the day
 * rolls over is allowed to finish first.
 */

import { parseCat, type CatConfig } from "./cat/config";
import {
  DEFAULT_SETTINGS,
  PomodoroTimer,
  sanitizeSettings,
  type TimerEvent,
  type TimerSettings,
  type TimerState,
} from "./timer";

export const STORAGE_KEY = "pomodoro-cat:v1";

export interface Prefs {
  sound: boolean;
  notifications: boolean;
}

export const DEFAULT_PREFS: Prefs = { sound: true, notifications: false };

export interface Saved {
  version: 1;
  cat: CatConfig | null;
  settings: TimerSettings;
  prefs: Prefs;
  timer: TimerState | null;
  day: string; // local YYYY-MM-DD the cycles/energy belong to
  savedAt: number; // epoch ms
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function emptySave(now: number): Saved {
  return {
    version: 1,
    cat: null,
    settings: DEFAULT_SETTINGS,
    prefs: DEFAULT_PREFS,
    timer: null,
    day: dayKey(now),
    savedAt: now,
  };
}

/** Parses untrusted JSON; anything unusable falls back to defaults field by field. */
export function parseSave(raw: string | null, now: number): Saved {
  const base = emptySave(now);
  if (!raw) return base;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!data || typeof data !== "object" || data.version !== 1) return base;

  const prefs = (data.prefs ?? {}) as Partial<Prefs>;
  return {
    version: 1,
    cat: parseCat(data.cat),
    settings: sanitizeSettings(data.settings as Partial<TimerSettings>),
    prefs: {
      sound: typeof prefs.sound === "boolean" ? prefs.sound : DEFAULT_PREFS.sound,
      notifications: typeof prefs.notifications === "boolean" ? prefs.notifications : DEFAULT_PREFS.notifications,
    },
    timer: isTimerState(data.timer) ? data.timer : null,
    day: typeof data.day === "string" ? data.day : base.day,
    savedAt: typeof data.savedAt === "number" && data.savedAt <= now ? data.savedAt : now,
  };
}

function isTimerState(t: unknown): t is TimerState {
  if (!t || typeof t !== "object") return false;
  const s = t as Record<string, unknown>;
  return (
    (s.phase === "focus" || s.phase === "shortBreak" || s.phase === "longBreak") &&
    typeof s.remaining === "number" &&
    typeof s.running === "boolean" &&
    typeof s.awaiting === "boolean" &&
    typeof s.cycles === "number" &&
    typeof s.energy === "number"
  );
}

export interface Restored {
  timer: PomodoroTimer;
  day: string;
  /** Events that happened while the app was closed (e.g. the focus ended). */
  missed: TimerEvent[];
}

/** Rebuilds the engine from a save, catching up on the time spent away. */
export function restoreTimer(saved: Saved, now: number): Restored {
  const timer = new PomodoroTimer(saved.settings, saved.timer ?? undefined);
  const missed = timer.tick((now - saved.savedAt) / 1000);
  const day = rollDay(timer, saved.day, now);
  return { timer, day, missed };
}

/**
 * Resets the day's progress once the date changed and nothing is running.
 * Returns the day the timer now belongs to.
 */
export function rollDay(timer: PomodoroTimer, day: string, now: number): string {
  const today = dayKey(now);
  if (day === today || timer.running) return day;
  timer.reset();
  return today;
}

export function loadSave(now = Date.now()): Saved {
  try {
    return parseSave(window.localStorage.getItem(STORAGE_KEY), now);
  } catch {
    return emptySave(now);
  }
}

export function writeSave(saved: Saved): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Private mode / quota: the app still works, it just won't remember.
  }
}
