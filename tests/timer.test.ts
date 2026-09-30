import { beforeEach, describe, expect, it } from "vitest";

import {
  BREAK_DONE,
  BREAK_STARTED,
  DEFAULT_SETTINGS,
  FOCUS,
  FOCUS_COST,
  FOCUS_DONE,
  FOCUS_STARTED,
  formatTime,
  LONG_BREAK,
  PomodoroTimer,
  sanitizeSettings,
  SHORT_BREAK,
  START_ENERGY,
} from "@/lib/timer";

const FOCUS_S = 80 * 60;
const BREAK_S = 20 * 60;

let timer: PomodoroTimer;

beforeEach(() => {
  timer = new PomodoroTimer({ focusMinutes: 80, shortBreakMinutes: 20, longBreakMinutes: 40, longBreakEvery: 3 });
});

/** Finishes the focus and starts the following break. */
function toBreak(t = timer) {
  t.skip();
  return t.advance();
}

describe("formatTime", () => {
  it.each([
    [0, "00:00"],
    [45, "00:45"],
    [120, "02:00"],
    [90, "01:30"],
    [25 * 60, "25:00"],
    [-5, "00:00"],
    [59.2, "01:00"], // counts down from the full minute
    [0.4, "00:01"],
  ])("%s -> %s", (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected);
  });
});

describe("settings", () => {
  it("defaults", () => {
    const t = new PomodoroTimer();
    expect(t.settings).toEqual(DEFAULT_SETTINGS);
    expect(t.remaining).toBe(25 * 60);
    expect(t.energy).toBe(START_ENERGY);
  });

  it("clamps and rounds out-of-range values", () => {
    expect(
      sanitizeSettings({ focusMinutes: 500, shortBreakMinutes: 0, longBreakMinutes: 12.6, longBreakEvery: -3 }),
    ).toEqual({ focusMinutes: 90, shortBreakMinutes: 1, longBreakMinutes: 13, longBreakEvery: 2 });
  });

  it("ignores garbage", () => {
    expect(sanitizeSettings({ focusMinutes: NaN, longBreakEvery: "x" as never })).toEqual(DEFAULT_SETTINGS);
  });

  it("an unstarted phase picks up the new duration", () => {
    timer.updateSettings({ focusMinutes: 10 });
    expect(timer.remaining).toBe(600);
  });

  it("a phase in progress keeps its remaining time, capped", () => {
    timer.start();
    timer.tick(60);
    timer.updateSettings({ focusMinutes: 85 });
    expect(timer.remaining).toBe(FOCUS_S - 60);
    timer.updateSettings({ focusMinutes: 5 });
    expect(timer.remaining).toBe(300);
  });
});

describe("controls", () => {
  it("toggle starts and pauses", () => {
    expect(timer.toggle()).toBeNull();
    expect(timer.running).toBe(true);
    expect(timer.toggle()).toBeNull();
    expect(timer.running).toBe(false);
  });

  it("toggle advances when awaiting", () => {
    timer.skip();
    expect(timer.awaiting).toBe(true);
    expect(timer.toggle()).toBe(BREAK_STARTED);
    expect(timer.phase).toBe(SHORT_BREAK);
    expect(timer.running).toBe(true);
    expect(timer.awaiting).toBe(false);
  });

  it("advance is a no-op unless awaiting", () => {
    expect(timer.advance()).toBeNull();
    expect(timer.phase).toBe(FOCUS);
  });

  it("break back to focus", () => {
    toBreak();
    timer.skip();
    expect(timer.toggle()).toBe(FOCUS_STARTED);
    expect(timer.phase).toBe(FOCUS);
    expect(timer.remaining).toBe(FOCUS_S);
  });

  it("start does nothing while awaiting", () => {
    timer.skip();
    timer.start();
    expect(timer.running).toBe(false);
  });

  it("skip finishes the focus and counts a cycle", () => {
    expect(timer.skip()).toBe(FOCUS_DONE);
    expect(timer.awaiting).toBe(true);
    expect(timer.running).toBe(false);
    expect(timer.remaining).toBe(0);
    expect(timer.cycles).toBe(1);
  });

  it("skip finishes a break without counting", () => {
    toBreak();
    expect(timer.skip()).toBe(BREAK_DONE);
    expect(timer.cycles).toBe(1);
  });

  it("reset restores the day", () => {
    timer.start();
    timer.tick(500);
    timer.cycles = 4;
    timer.energy = 10;
    timer.reset();
    expect(timer.snapshot()).toEqual({
      phase: FOCUS,
      remaining: FOCUS_S,
      running: false,
      awaiting: false,
      cycles: 0,
      energy: START_ENERGY,
    });
  });
});

describe("long breaks", () => {
  it("every Nth completed focus gets a long break", () => {
    const phases = [];
    for (let i = 0; i < 6; i++) {
      toBreak();
      phases.push(timer.phase);
      timer.skip();
      timer.advance(); // back to focus
    }
    expect(phases).toEqual([SHORT_BREAK, SHORT_BREAK, LONG_BREAK, SHORT_BREAK, SHORT_BREAK, LONG_BREAK]);
  });

  it("nextPhase announces the long break before the focus even ends", () => {
    toBreak();
    timer.skip();
    timer.advance();
    toBreak();
    timer.skip();
    timer.advance(); // third focus in progress
    expect(timer.nextPhase).toBe(LONG_BREAK);
  });

  it("uses the long break duration", () => {
    timer.cycles = 2;
    toBreak();
    expect(timer.phase).toBe(LONG_BREAK);
    expect(timer.remaining).toBe(40 * 60);
  });

  it("a full long break always recovers to 100%", () => {
    timer.cycles = 2;
    timer.energy = 3;
    toBreak();
    timer.tick(40 * 60);
    expect(timer.energy).toBe(100);
  });
});

describe("tick & energy", () => {
  it("does nothing while paused", () => {
    expect(timer.tick(10)).toEqual([]);
    expect(timer.remaining).toBe(FOCUS_S);
  });

  it("ignores non-positive and NaN dt", () => {
    timer.start();
    expect(timer.tick(0)).toEqual([]);
    expect(timer.tick(-5)).toEqual([]);
    expect(timer.tick(NaN)).toEqual([]);
    expect(timer.remaining).toBe(FOCUS_S);
  });

  it("focus drains energy in proportion to the session", () => {
    timer.start();
    timer.tick(FOCUS_S / 2);
    expect(timer.energy).toBeCloseTo(START_ENERGY - FOCUS_COST / 2);
  });

  it("the end of focus waits for the user", () => {
    timer.start();
    expect(timer.tick(FOCUS_S)).toEqual([FOCUS_DONE]);
    expect(timer.phase).toBe(FOCUS);
    expect(timer.awaiting).toBe(true);
    expect(timer.energy).toBeCloseTo(START_ENERGY - FOCUS_COST);
  });

  it("a short break gives the focus cost back", () => {
    timer.start();
    timer.tick(FOCUS_S);
    timer.advance();
    expect(timer.tick(BREAK_S)).toEqual([BREAK_DONE]);
    expect(timer.energy).toBeCloseTo(START_ENERGY);
  });

  it("overshoot only counts the time that was left", () => {
    timer.start();
    timer.tick(FOCUS_S - 10);
    const before = timer.energy;
    timer.tick(10_000);
    expect(timer.energy).toBeCloseTo(before - (FOCUS_COST / FOCUS_S) * 10);
  });

  it("energy stays within 0..100", () => {
    timer.energy = 1;
    timer.start();
    timer.tick(FOCUS_S);
    expect(timer.energy).toBe(0);
    timer.energy = 99;
    timer.advance();
    timer.tick(BREAK_S);
    expect(timer.energy).toBe(100);
  });
});

describe("snapshot / restore", () => {
  it("round-trips through the constructor", () => {
    timer.start();
    timer.tick(123);
    const copy = new PomodoroTimer(timer.settings, JSON.parse(JSON.stringify(timer.snapshot())));
    expect(copy.snapshot()).toEqual(timer.snapshot());
  });

  it("repairs inconsistent state", () => {
    const t = new PomodoroTimer({}, { running: true, awaiting: true, remaining: 1e9, energy: 500, cycles: -2 });
    expect(t.running).toBe(false);
    expect(t.remaining).toBe(25 * 60);
    expect(t.energy).toBe(100);
    expect(t.cycles).toBe(0);
  });

  it("progress", () => {
    timer.remaining = FOCUS_S / 4;
    expect(timer.progress).toBeCloseTo(0.75);
    timer.skip();
    expect(timer.progress).toBe(1);
  });
});
