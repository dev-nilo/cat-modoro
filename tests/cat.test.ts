import { describe, expect, it } from "vitest";

import { ACCESSORIES, COATS, EYES, cleanName, parseCat, randomCat, type CatConfig } from "@/lib/cat/config";
import { renderStage, STAGE_H, STAGE_W } from "@/lib/cat/render";
import { ALL_GRIDS, buildLayers, CAT_SIZE, rasterize } from "@/lib/cat/sprites";
import { catFrame, catState, STATE_CAPTIONS, type CatState } from "@/lib/cat/state";
import { initialState, DEFAULT_SETTINGS, type TimerState } from "@/lib/timer";

const KEYS = new Set([..."ofplinekwbrcCy."]);
const STATES = Object.keys(STATE_CAPTIONS) as CatState[];

const base = initialState(DEFAULT_SETTINGS);
const t = (over: Partial<TimerState>): TimerState => ({ ...base, ...over });
const calm = { stretching: false, petting: false };

describe("sprite grids", () => {
  it.each(Object.entries(ALL_GRIDS))("%s is rectangular and uses known keys", (_, rows) => {
    expect(rows.length).toBeGreaterThan(0);
    const width = rows[0].length;
    for (const row of rows) {
      expect(row.length).toBe(width);
      for (const key of row) expect(KEYS.has(key)).toBe(true);
    }
  });

  it("every state × accessory stays inside the 32x32 canvas", () => {
    for (const state of STATES) {
      for (const { id } of ACCESSORIES) {
        for (const time of [0, 0.3, 1.1, 2.5, 6.9]) {
          const frame = catFrame(state, time, false, time);
          const grid = rasterize(buildLayers(frame, id));
          expect(grid).toHaveLength(CAT_SIZE);
          const drawn = grid.flat().filter((k) => k !== ".").length;
          expect(drawn).toBeGreaterThan(200);
        }
      }
    }
  });

  it("the face is drawn in every state", () => {
    for (const state of STATES) {
      const grid = rasterize(buildLayers(catFrame(state, 1, true, 0), "none"));
      expect(grid.flat()).toContain("n"); // nose
    }
  });
});

describe("renderStage", () => {
  const cat: CatConfig = { name: "Mochi", coat: "calico", eyes: "heterochromia", accessory: "bellCollar" };

  it("renders every coat, eye color and state", () => {
    for (const coat of COATS) {
      for (const eyes of EYES) {
        for (const state of STATES) {
          const px = renderStage({
            cat: { ...cat, coat: coat.id, eyes: eyes.id },
            state,
            t: 1.3,
            sincePet: 0.3,
            sinceStretch: 0.5,
            reducedMotion: false,
            scene: true,
          });
          expect(px).toHaveLength(STAGE_W * STAGE_H * 4);
        }
      }
    }
  });

  it("odd eyes really are two colors", () => {
    const px = renderStage({ cat, state: "idle", t: 1, sincePet: Infinity, sinceStretch: Infinity, reducedMotion: true, scene: false });
    const colors = new Set<string>();
    for (let i = 0; i < px.length; i += 4) colors.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);
    expect(colors).toContain("111,176,240"); // blue
    expect(colors).toContain("242,181,58"); // amber
  });

  it("reduced motion is deterministic", () => {
    const input = { cat, state: "idle" as const, sincePet: Infinity, sinceStretch: Infinity, reducedMotion: true, scene: true };
    expect(renderStage({ ...input, t: 0.2 })).toEqual(renderStage({ ...input, t: 3.7 }));
  });
});

describe("catState", () => {
  it.each<[Partial<TimerState>, CatState]>([
    [{}, "idle"],
    [{ running: true }, "focus"],
    [{ running: true, energy: 40 }, "tired"],
    [{ running: true, energy: 15 }, "grumpy"],
    [{ running: true, energy: 3 }, "possessed"],
    [{ awaiting: true, remaining: 0 }, "awaiting"],
    [{ phase: "shortBreak", running: true, energy: 50 }, "sleeping"],
    [{ phase: "longBreak", running: true, energy: 90 }, "happy"],
    [{ energy: 30 }, "tired"],
  ])("%j -> %s", (over, expected) => {
    expect(catState(t(over), calm)).toBe(expected);
  });

  it("reactions take priority", () => {
    expect(catState(t({ awaiting: true }), { stretching: true, petting: true })).toBe("stretch");
    expect(catState(t({ phase: "shortBreak", running: true, energy: 10 }), { stretching: false, petting: true })).toBe(
      "happy",
    );
    expect(catState(t({ awaiting: true }), { stretching: false, petting: true })).toBe("awaiting");
  });
});

describe("config", () => {
  it("randomCat is always valid", () => {
    for (let i = 0; i < 50; i++) expect(parseCat(randomCat())).not.toBeNull();
  });

  it("cleanName trims, collapses spaces and caps length", () => {
    expect(cleanName("  Sir   Fluffington the Third  ")).toBe("Sir Fluffington");
    expect(cleanName("   ")).toBe("");
  });
});
