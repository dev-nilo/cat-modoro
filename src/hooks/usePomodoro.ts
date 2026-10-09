"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { meow, notify, purr, requestNotifications, unlockAudio } from "@/lib/browser";
import type { CatConfig } from "@/lib/cat/config";
import { catState, PET_TIME, STRETCH_TIME, type CatState } from "@/lib/cat/state";
import {
  clientId,
  emptyHistory,
  finish,
  flushOutbox,
  loadHistory,
  observe,
  writeHistory,
  type HistoryState,
  type NewSession,
} from "@/lib/history";
import { dayKey, loadSave, restoreTimer, rollDay, writeSave, type Prefs } from "@/lib/storage";
import {
  BREAK_DONE,
  BREAK_STARTED,
  FOCUS,
  FOCUS_DONE,
  formatTime,
  LONG_BREAK,
  PomodoroTimer,
  type TimerEvent,
  type TimerSettings,
  type TimerState,
} from "@/lib/timer";

const TICK_MS = 250;

export interface Pomodoro {
  timer: TimerState;
  settings: TimerSettings;
  prefs: Prefs;
  cat: CatConfig | null;
  catState: CatState;
  /** Date.now() of the last pet / break-start stretch (-Infinity if none). */
  petAt: number;
  stretchAt: number;
  actionLabel: string;
  nextBreakIsLong: boolean;

  /** Advances the clock now. The hook ticks on its own; extra callers (e.g. the PiP window) are harmless. */
  tick(): void;
  primary(): void;
  skip(): void;
  reset(): void;
  pet(): void;
  adopt(cat: CatConfig): void;
  /** Silent edit from the settings (no meow / hearts). */
  updateCat(cat: CatConfig): void;
  updateSettings(s: Partial<TimerSettings>): void;
  setSound(on: boolean): void;
  /** Resolves to whether notifications ended up enabled (permission may be denied). */
  setNotifications(on: boolean): Promise<boolean>;
}

/** Returns null until the saved state has been loaded (client only). */
export function usePomodoro(): Pomodoro | null {
  const engine = useRef<PomodoroTimer | null>(null);
  const day = useRef("");
  const lastTick = useRef(0);

  const [loaded, setLoaded] = useState(false);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [settings, setSettings] = useState<TimerSettings | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({ sound: true, notifications: false });
  const [cat, setCat] = useState<CatConfig | null>(null);
  const [petAt, setPetAt] = useState(-Infinity);
  const [stretchAt, setStretchAt] = useState(-Infinity);
  const [now, setNow] = useState(0);

  const history = useRef<HistoryState>(emptyHistory());
  const flushing = useRef(false);

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const catRef = useRef(cat);
  catRef.current = cat;

  const sync = useCallback(() => {
    const t = engine.current!;
    setTimer(t.snapshot());
    setNow(Date.now());
  }, []);

  // History: POST finished phases in the background; whatever fails stays queued.
  const flush = useCallback(async () => {
    if (flushing.current || history.current.outbox.length === 0) return;
    flushing.current = true;
    try {
      const sent = history.current.outbox;
      const left = new Set((await flushOutbox(sent, clientId())).map((r) => r.id));
      const done = new Set(sent.filter((r) => !left.has(r.id)).map((r) => r.id));
      // Records queued while we were sending are kept.
      history.current = { ...history.current, outbox: history.current.outbox.filter((r) => !done.has(r.id)) };
      writeHistory(history.current);
    } finally {
      flushing.current = false;
    }
  }, []);

  /** Notes when a phase starts and, when one ends, queues its record. */
  const track = useCallback(
    (t: PomodoroTimer, at: number, end?: { outcome: NewSession["outcome"]; endedAt: number }) => {
      let h = history.current;
      if (end) {
        const phaseEnd = { phase: t.phase, outcome: end.outcome, endedAt: end.endedAt, plannedSeconds: t.duration };
        h = finish(h, phaseEnd, crypto.randomUUID());
      }
      h = observe(h, t.snapshot(), !t.running && !t.awaiting && t.progress === 0, at);
      if (h !== history.current) {
        history.current = h;
        writeHistory(h);
      }
      if (end) void flush();
    },
    [flush],
  );

  useEffect(() => {
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [flush]);

  // Load once on the client.
  useEffect(() => {
    const at = Date.now();
    const saved = loadSave(at);
    const restored = restoreTimer(saved, at);
    history.current = loadHistory();
    // A phase that ran out while the app was closed ended when its time did.
    const endedAway = restored.missed.some((e) => e === FOCUS_DONE || e === BREAK_DONE) && saved.timer;
    track(
      restored.timer,
      at,
      endedAway ? { outcome: "completed", endedAt: saved.savedAt + saved.timer!.remaining * 1000 } : undefined,
    );
    if (!endedAway) void flush();
    engine.current = restored.timer;
    day.current = restored.day;
    lastTick.current = at;
    setSettings(restored.timer.settings);
    setPrefs(saved.prefs);
    setCat(saved.cat);
    setTimer(restored.timer.snapshot());
    setNow(at);
    setLoaded(true);
  }, [flush, track]); // both stable: runs once

  const onPhaseEnd = useCallback((events: TimerEvent[]) => {
    const done = events.find((e) => e === FOCUS_DONE || e === BREAK_DONE);
    if (!done) return;
    const { sound, notifications } = prefsRef.current;
    const name = catRef.current?.name ?? "Your cat";
    if (sound) meow(2);
    if (notifications && (document.hidden || !document.hasFocus())) {
      if (done === FOCUS_DONE) notify("Focus done!", `${name} is waiting for you to start a break.`);
      else notify("Break's over", `${name} is rested and ready to focus.`);
    }
  }, []);

  // Clock: advance by wall time, so a throttled background tab (or several
  // clocks ticking at once) stays accurate.
  const tick = useCallback(() => {
    const t = engine.current;
    if (!t) return;
    const at = Date.now();
    const events = t.tick((at - lastTick.current) / 1000);
    lastTick.current = at;
    day.current = rollDay(t, day.current, at);
    const ended = events.some((e) => e === FOCUS_DONE || e === BREAK_DONE);
    track(t, at, ended ? { outcome: "completed", endedAt: at } : undefined);
    onPhaseEnd(events);
    sync();
  }, [onPhaseEnd, sync, track]);

  useEffect(() => {
    if (!loaded) return;
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [loaded, tick]);

  // Persist on every change, and once more when the page goes away.
  useEffect(() => {
    if (!loaded || !timer || !settings) return;
    const save = () =>
      writeSave({
        version: 1,
        cat: catRef.current,
        settings: engine.current!.settings,
        prefs: prefsRef.current,
        timer: engine.current!.snapshot(),
        day: day.current,
        savedAt: Date.now(),
      });
    save();
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [loaded, timer, settings, prefs, cat]);

  // Tab title
  useEffect(() => {
    if (!timer) return;
    const t = engine.current!;
    const status = timer.awaiting ? "⏰ " : "";
    document.title = `${status}${formatTime(timer.remaining)} · ${t.phaseLabel} — Pomodoro Cat`;
  }, [timer]);

  const primary = useCallback(() => {
    unlockAudio();
    const event = engine.current!.toggle();
    if (event === BREAK_STARTED) setStretchAt(Date.now());
    lastTick.current = Date.now();
    track(engine.current!, Date.now());
    sync();
  }, [sync, track]);

  const skip = useCallback(() => {
    engine.current!.skip();
    track(engine.current!, Date.now(), { outcome: "skipped", endedAt: Date.now() });
    sync();
  }, [sync, track]);

  const reset = useCallback(() => {
    engine.current!.reset();
    day.current = dayKey(Date.now());
    track(engine.current!, Date.now());
    setStretchAt(-Infinity);
    sync();
  }, [sync, track]);

  const pet = useCallback(() => {
    unlockAudio();
    setPetAt(Date.now());
    if (prefsRef.current.sound) purr();
  }, []);

  const adopt = useCallback((next: CatConfig) => {
    unlockAudio();
    setCat(next);
    setPetAt(Date.now());
    if (prefsRef.current.sound) meow();
  }, []);

  const updateSettings = useCallback(
    (s: Partial<TimerSettings>) => {
      engine.current!.updateSettings(s);
      setSettings(engine.current!.settings);
      sync();
    },
    [sync],
  );

  const setSound = useCallback((on: boolean) => {
    if (on) unlockAudio();
    setPrefs((p) => ({ ...p, sound: on }));
  }, []);

  const setNotifications = useCallback(async (on: boolean) => {
    const allowed = on ? await requestNotifications() : false;
    setPrefs((p) => ({ ...p, notifications: allowed }));
    return allowed;
  }, []);

  return useMemo(() => {
    if (!loaded || !timer || !settings) return null;
    const t = engine.current!;
    const reactions = {
      stretching: now - stretchAt < STRETCH_TIME * 1000,
      petting: now - petAt < PET_TIME * 1000,
    };
    return {
      timer,
      settings,
      prefs,
      cat,
      catState: catState(timer, reactions),
      petAt,
      stretchAt,
      actionLabel: actionLabel(t),
      nextBreakIsLong: t.phase === FOCUS && t.nextPhase === LONG_BREAK,
      tick,
      primary,
      skip,
      reset,
      pet,
      adopt,
      updateCat: setCat,
      updateSettings,
      setSound,
      setNotifications,
    };
  }, [
    loaded,
    timer,
    settings,
    prefs,
    cat,
    petAt,
    stretchAt,
    now,
    tick,
    primary,
    skip,
    reset,
    pet,
    adopt,
    updateSettings,
    setSound,
    setNotifications,
  ]);
}

function actionLabel(t: PomodoroTimer): string {
  if (t.awaiting) {
    if (t.phase !== FOCUS) return "Start focus";
    return t.nextPhase === LONG_BREAK ? "Start long break" : "Start break";
  }
  if (t.running) return "Pause";
  if (t.progress > 0) return "Resume";
  return t.phase === FOCUS ? "Start focus" : "Start break";
}
