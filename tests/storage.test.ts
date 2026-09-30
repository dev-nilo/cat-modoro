import { describe, expect, it } from "vitest";

import { dayKey, emptySave, parseSave, restoreTimer, type Saved } from "@/lib/storage";
import { FOCUS_DONE, initialState, SHORT_BREAK, START_ENERGY, type TimerState } from "@/lib/timer";

const at = (iso: string) => new Date(iso).getTime();

function save(overrides: Partial<Saved>, now: number): Saved {
  return { ...emptySave(now), ...overrides };
}

describe("parseSave", () => {
  const now = at("2026-09-30T10:00:00");

  it.each([null, "", "not json", "[]", '{"version":2}'])("falls back to defaults for %j", (raw) => {
    expect(parseSave(raw as string | null, now)).toEqual(emptySave(now));
  });

  it("keeps valid fields and repairs the rest", () => {
    const raw = JSON.stringify({
      version: 1,
      cat: { name: "  Mochi  ", coat: "calico", eyes: "green", accessory: "cape" },
      settings: { focusMinutes: 999 },
      prefs: { sound: false, notifications: "yes" },
      timer: { phase: "nope" },
      day: "2026-09-30",
      savedAt: now + 60_000, // from the future: ignored
    });
    const s = parseSave(raw, now);
    expect(s.cat).toEqual({ name: "Mochi", coat: "calico", eyes: "green", accessory: "none" });
    expect(s.settings.focusMinutes).toBe(90);
    expect(s.prefs).toEqual({ sound: false, notifications: false });
    expect(s.timer).toBeNull();
    expect(s.savedAt).toBe(now);
  });

  it("rejects a cat with an unknown coat", () => {
    const raw = JSON.stringify({ version: 1, cat: { name: "X", coat: "plaid", eyes: "green" } });
    expect(parseSave(raw, now).cat).toBeNull();
  });
});

describe("restoreTimer", () => {
  it("keeps running while the app was closed", () => {
    const saved = at("2026-09-30T10:00:00");
    const timer = { ...initialState(emptySave(saved).settings), running: true };
    const { timer: t, missed } = restoreTimer(save({ timer, savedAt: saved }, saved), saved + 10 * 60_000);
    expect(t.remaining).toBe(15 * 60);
    expect(t.running).toBe(true);
    expect(missed).toEqual([]);
  });

  it("reports a session that ended while away", () => {
    const saved = at("2026-09-30T10:00:00");
    const timer = { ...initialState(emptySave(saved).settings), running: true };
    const { timer: t, missed } = restoreTimer(save({ timer, savedAt: saved }, saved), saved + 60 * 60_000);
    expect(missed).toEqual([FOCUS_DONE]);
    expect(t.awaiting).toBe(true);
    expect(t.cycles).toBe(1);
  });

  it("a paused timer doesn't move", () => {
    const saved = at("2026-09-30T10:00:00");
    const timer = { ...initialState(emptySave(saved).settings), remaining: 600 };
    const { timer: t } = restoreTimer(save({ timer, savedAt: saved }, saved), saved + 3_600_000);
    expect(t.remaining).toBe(600);
  });

  it("a new day resets cycles and energy", () => {
    const saved = at("2026-09-29T18:00:00");
    const timer: TimerState = { ...initialState(emptySave(saved).settings), cycles: 5, energy: 12, phase: SHORT_BREAK, awaiting: true, remaining: 0 };
    const now = at("2026-09-30T09:00:00");
    const r = restoreTimer(save({ timer, savedAt: saved, day: dayKey(saved) }, saved), now);
    expect(r.day).toBe("2026-09-30");
    expect(r.timer.cycles).toBe(0);
    expect(r.timer.energy).toBe(START_ENERGY);
  });

  it("a session running across midnight finishes before the reset", () => {
    const saved = at("2026-09-29T23:50:00");
    const timer = { ...initialState(emptySave(saved).settings), cycles: 3, running: true };
    const now = at("2026-09-30T00:05:00"); // 15 of the 25 minutes elapsed
    const r = restoreTimer(save({ timer, savedAt: saved, day: dayKey(saved) }, saved), now);
    expect(r.day).toBe("2026-09-29");
    expect(r.timer.cycles).toBe(3);
    expect(r.timer.running).toBe(true);
  });
});
