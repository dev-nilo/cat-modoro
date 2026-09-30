/**
 * What the cat is doing: derived from the timer plus short-lived reactions
 * (petting, the stretch at the start of a break), then turned into the
 * concrete sprite frame for a moment in time.
 */

import { FOCUS, type TimerState } from "../timer";
import type { CatFrame, Eyes, Mouth } from "./sprites";

export type CatState =
  | "idle"
  | "focus"
  | "tired"
  | "grumpy"
  | "possessed"
  | "awaiting"
  | "stretch"
  | "sleeping"
  | "happy";

export const TIRED_MAX = 45;
export const GRUMPY_MAX = 20;
export const POSSESSED_MAX = 5;
export const RECOVERED_MIN = 70;

/** Seconds the stretch reaction lasts after a break starts. */
export const STRETCH_TIME = 2.4;
/** Seconds of purring after a pet. */
export const PET_TIME = 1.6;

export interface Reactions {
  stretching: boolean;
  petting: boolean;
}

export function catState(t: TimerState, r: Reactions): CatState {
  if (r.stretching) return "stretch";
  if (t.awaiting) return "awaiting";
  if (r.petting) return "happy";
  if (t.running && t.phase !== FOCUS) return t.energy < RECOVERED_MIN ? "sleeping" : "happy";
  if (t.energy <= POSSESSED_MAX) return "possessed";
  if (t.energy <= GRUMPY_MAX) return "grumpy";
  if (t.energy <= TIRED_MAX) return "tired";
  return t.running ? "focus" : "idle";
}

export const STATE_CAPTIONS: Record<CatState, (name: string) => string> = {
  idle: (n) => `${n} is ready when you are`,
  focus: (n) => `${n} is focusing with you`,
  tired: (n) => `${n} is getting sleepy…`,
  grumpy: (n) => `${n} is grumpy. A break, maybe?`,
  possessed: (n) => `${n} has become something else`,
  awaiting: (n) => `${n} is waiting for you`,
  stretch: (n) => `${n} stretches out`,
  sleeping: (n) => `${n} is napping`,
  happy: (n) => `${n} is purring`,
};

const cycle = <T>(t: number, period: number, values: readonly T[]): T =>
  values[Math.floor(t / period) % values.length];

/**
 * The sprite frame for `state` at time `t` (seconds). `sinceStretch` is how
 * long the stretch reaction has been playing. Reduced motion freezes all
 * idle animation (breathing, tail, blinking).
 */
export function catFrame(state: CatState, t: number, reducedMotion = false, sinceStretch = 0): CatFrame {
  const still = reducedMotion;
  const breath = (period: number) => (still ? 0 : cycle(t, period, [0, 1]));
  const swish = (period: number, values: readonly number[]) => (still ? 0 : cycle(t, period, values));
  const blinking = !still && t % 4.2 < 0.14;
  const open = (eyes: Eyes): Eyes => (blinking ? "blink" : eyes);

  switch (state) {
    case "focus":
      return {
        pose: "loaf",
        headBob: breath(1.4),
        ears: "up",
        eyes: open("focus"),
        mouth: "flat",
        blush: false,
        tail: "loaf",
        swish: swish(0.9, [0, 1, 0, 0]),
      };
    case "tired": {
      const yawning = !still && t % 7 < 1.2;
      return {
        pose: "sit",
        headBob: breath(1.3),
        ears: "droop",
        eyes: yawning ? "closed" : open("tired"),
        mouth: yawning ? "meow" : "tired",
        blush: false,
        tail: "sit",
        swish: swish(1.1, [0, 1]),
      };
    }
    case "grumpy":
      return {
        pose: "sit",
        headBob: 0,
        ears: "back",
        eyes: "grumpy",
        mouth: "frown",
        blush: false,
        tail: "puffy",
        swish: swish(0.18, [0, 1]),
      };
    case "possessed":
      return {
        pose: "sit",
        headBob: 0,
        ears: "back",
        eyes: "possessed",
        mouth: "fangs",
        blush: false,
        tail: "puffy",
        swish: swish(0.12, [-1, 1]),
      };
    case "awaiting":
      return {
        pose: "sit",
        headBob: breath(0.45),
        ears: "up",
        eyes: "open",
        mouth: swish(0.45, [0, 1]) ? "meow" : "smile",
        blush: false,
        tail: "sit",
        swish: swish(0.25, [-1, 0, 1, 0]),
      };
    case "stretch":
      // Stretch first, then pop up happy for the rest of the reaction.
      if (sinceStretch < 1.4) {
        return {
          pose: "stretch",
          headBob: 0,
          ears: "up",
          eyes: "happy",
          mouth: "meow",
          blush: true,
          tail: "stretch",
          swish: swish(0.2, [-1, 0, 1, 0]),
        };
      }
      return happy(t, still);
    case "sleeping":
      return {
        pose: "sleep",
        headBob: breath(1.8),
        ears: "droop",
        eyes: "closed",
        mouth: "none",
        blush: true,
        tail: "loaf",
        swish: 0,
      };
    case "happy":
      return happy(t, still);
    case "idle":
    default:
      return {
        pose: "sit",
        headBob: breath(1.0),
        ears: "up",
        eyes: open("open"),
        mouth: "smile" satisfies Mouth,
        blush: false,
        tail: "sit",
        swish: swish(0.4, [-1, 0, 1, 0]),
      };
  }
}

function happy(t: number, still: boolean): CatFrame {
  return {
    pose: "sit",
    headBob: still ? 0 : cycle(t, 0.35, [0, 1]),
    ears: "up",
    eyes: "happy",
    mouth: "smile",
    blush: true,
    tail: "sit",
    swish: still ? 0 : cycle(t, 0.18, [-1, 0, 1, 0]),
  };
}
