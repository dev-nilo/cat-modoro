/**
 * Pure Pomodoro engine: focus / short break / long break cycle plus the cat's
 * energy. No DOM, no React — everything here runs (and is tested) in Node.
 *
 * Flow (phase changes are always manual):
 *     FOCUS (running) --time's up--> FOCUS (awaiting the user)
 *         --advance()--> BREAK (running) --time's up--> BREAK (awaiting)
 *         --advance()--> FOCUS ...
 * Every `longBreakEvery` completed focus sessions the break is a long one.
 */

export const FOCUS = "focus";
export const SHORT_BREAK = "shortBreak";
export const LONG_BREAK = "longBreak";
export type Phase = typeof FOCUS | typeof SHORT_BREAK | typeof LONG_BREAK;

export const PHASE_LABELS: Record<Phase, string> = {
  focus: "Focus",
  shortBreak: "Break",
  longBreak: "Long break",
};

// Events returned by tick() / skip() / toggle() / advance()
export const FOCUS_DONE = "focusDone";
export const BREAK_DONE = "breakDone";
export const BREAK_STARTED = "breakStarted";
export const FOCUS_STARTED = "focusStarted";
export type TimerEvent = typeof FOCUS_DONE | typeof BREAK_DONE | typeof BREAK_STARTED | typeof FOCUS_STARTED;

export const MAX_ENERGY = 100;
export const START_ENERGY = 85;
/** Energy lost over one full focus session / regained over one short break. */
export const FOCUS_COST = 45;
export const BREAK_RESTORE = 45;

export interface TimerSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
}

export const DEFAULT_SETTINGS: TimerSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
};

export const SETTING_LIMITS: Record<keyof TimerSettings, { min: number; max: number }> = {
  focusMinutes: { min: 1, max: 90 },
  shortBreakMinutes: { min: 1, max: 30 },
  longBreakMinutes: { min: 5, max: 60 },
  longBreakEvery: { min: 2, max: 8 },
};

/** Clamps every field into its allowed range; missing/invalid fields fall back to defaults. */
export function sanitizeSettings(input: Partial<TimerSettings> | undefined): TimerSettings {
  const out = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(SETTING_LIMITS) as (keyof TimerSettings)[]) {
    const value = Number(input?.[key]);
    if (!Number.isFinite(value)) continue;
    const { min, max } = SETTING_LIMITS[key];
    out[key] = Math.round(Math.min(max, Math.max(min, value)));
  }
  return out;
}

/** Everything needed to rebuild the engine; plain JSON. */
export interface TimerState {
  phase: Phase;
  remaining: number; // seconds
  running: boolean;
  awaiting: boolean;
  cycles: number; // focus sessions completed today
  energy: number; // 0..100
}

export function initialState(settings: TimerSettings): TimerState {
  return {
    phase: FOCUS,
    remaining: settings.focusMinutes * 60,
    running: false,
    awaiting: false,
    cycles: 0,
    energy: START_ENERGY,
  };
}

const clampEnergy = (e: number) => Math.max(0, Math.min(MAX_ENERGY, e));

export class PomodoroTimer {
  settings: TimerSettings;
  phase: Phase;
  remaining: number;
  running: boolean;
  awaiting: boolean;
  cycles: number;
  energy: number;

  constructor(settings: Partial<TimerSettings> = {}, state?: Partial<TimerState>) {
    this.settings = sanitizeSettings(settings);
    const s = { ...initialState(this.settings), ...state };
    this.phase = s.phase;
    this.remaining = Math.max(0, Math.min(s.remaining, this.durationOf(s.phase)));
    this.awaiting = s.awaiting;
    this.running = s.running && !s.awaiting;
    this.cycles = Math.max(0, Math.trunc(s.cycles));
    this.energy = clampEnergy(s.energy);
  }

  // --- controls ---
  start(): void {
    if (!this.awaiting) this.running = true;
  }

  pause(): void {
    this.running = false;
  }

  /** Start/pause; when awaiting, starts the next phase. Returns the transition event, if any. */
  toggle(): TimerEvent | null {
    if (this.awaiting) return this.advance();
    this.running = !this.running;
    return null;
  }

  /** Starts the next phase from the awaiting state. */
  advance(): TimerEvent | null {
    if (!this.awaiting) return null;
    const next = this.nextPhase;
    this.awaiting = false;
    this.running = true;
    this.phase = next;
    this.remaining = this.durationOf(next);
    return next === FOCUS ? FOCUS_STARTED : BREAK_STARTED;
  }

  /** Ends the current phase now, leaving the cat awaiting. */
  skip(): TimerEvent {
    return this.finishPhase();
  }

  /** Fresh day: back to focus with starting energy and no cycles. */
  reset(): void {
    Object.assign(this, initialState(this.settings));
  }

  /**
   * Applies new settings. A phase that hasn't started picks up the new
   * duration; one in progress keeps its remaining time (capped to the new length).
   */
  updateSettings(input: Partial<TimerSettings>): void {
    const untouched = !this.running && !this.awaiting && this.remaining === this.duration;
    this.settings = sanitizeSettings({ ...this.settings, ...input });
    if (this.awaiting) return;
    this.remaining = untouched ? this.duration : Math.min(this.remaining, this.duration);
  }

  // --- simulation ---
  /** Advances `dt` seconds. Returns the events that happened. */
  tick(dt: number): TimerEvent[] {
    if (!this.running || this.awaiting || !(dt > 0)) return [];

    this.applyEnergy(Math.min(dt, this.remaining));
    if (this.remaining > dt) {
      this.remaining -= dt;
      return [];
    }
    return [this.finishPhase()];
  }

  private applyEnergy(seconds: number): void {
    const duration = this.duration;
    if (duration <= 0) return;
    if (this.phase === FOCUS) this.energy -= (FOCUS_COST / duration) * seconds;
    // A full long break always brings the cat back to 100%.
    else if (this.phase === LONG_BREAK) this.energy += (MAX_ENERGY / duration) * seconds;
    else this.energy += (BREAK_RESTORE / duration) * seconds;
    this.energy = clampEnergy(this.energy);
  }

  private finishPhase(): TimerEvent {
    this.running = false;
    this.awaiting = true;
    this.remaining = 0;
    if (this.phase === FOCUS) {
      this.cycles += 1;
      return FOCUS_DONE;
    }
    return BREAK_DONE;
  }

  // --- queries ---
  durationOf(phase: Phase): number {
    const s = this.settings;
    const minutes =
      phase === FOCUS ? s.focusMinutes : phase === LONG_BREAK ? s.longBreakMinutes : s.shortBreakMinutes;
    return minutes * 60;
  }

  get duration(): number {
    return this.durationOf(this.phase);
  }

  get isBreak(): boolean {
    return this.phase !== FOCUS;
  }

  get nextPhase(): Phase {
    if (this.phase !== FOCUS) return FOCUS;
    // Called after the focus finished (cycles already counted) or before it
    // started; either way the long break lands on every Nth completed focus.
    const completed = this.awaiting ? this.cycles : this.cycles + 1;
    return completed > 0 && completed % this.settings.longBreakEvery === 0 ? LONG_BREAK : SHORT_BREAK;
  }

  /** Fraction of the current phase already elapsed (0..1). */
  get progress(): number {
    if (this.duration <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - this.remaining / this.duration));
  }

  get phaseLabel(): string {
    return PHASE_LABELS[this.phase];
  }

  snapshot(): TimerState {
    const { phase, remaining, running, awaiting, cycles, energy } = this;
    return { phase, remaining, running, awaiting, cycles, energy };
  }
}

export function formatTime(seconds: number): string {
  // Round up so the display shows 25:00 for the whole first second and 00:00 only at the end.
  const total = Math.max(0, Math.ceil(seconds - 1e-6));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
