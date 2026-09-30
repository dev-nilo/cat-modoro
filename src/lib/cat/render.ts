/**
 * Turns a cat + state + time into RGBA pixels for a small "stage" (the cat,
 * its cushion and effects like hearts or zZ). Pure: returns a pixel buffer,
 * so it runs in tests; the React component blits it onto a scaled canvas.
 */

import type { CatConfig } from "./config";
import { ACCESSORY_COLORS, COAT_COLORS, EYE_COLORS, FX, SHARED, hex, type RGB } from "./palette";
import { buildLayers, CAT_SIZE, rasterize } from "./sprites";
import { catFrame, STRETCH_TIME, type CatState } from "./state";

export const STAGE_W = 48;
export const STAGE_H = 44;
export const CAT_X = 8;
export const CAT_Y = 8;

export interface StageInput {
  cat: CatConfig;
  state: CatState;
  /** Seconds, monotonic; drives idle animation. */
  t: number;
  /** Seconds since the last pet (Infinity if none). */
  sincePet: number;
  /** Seconds since the break-start stretch began (Infinity if none). */
  sinceStretch: number;
  reducedMotion: boolean;
  /** Draw the cushion (main page) or just a soft shadow (floating window). */
  scene: boolean;
}

type Sprite = readonly string[];

const HEART: Sprite = ["cc.cc", "ccccc", "ccccc", ".ccc.", "..c.."];
const ZED: Sprite = ["zzzz", "..z.", ".z..", "zzzz"];
const SPARK: Sprite = [".s.", "sss", ".s."];
const BUBBLE: Sprite = [
  ".ooooo.",
  "owwwwwo",
  "owwkwwo",
  "owwkwwo",
  "owwkwwo",
  "owwwwwo",
  "owwkwwo",
  "owwwwwo",
  ".ooooo.",
  "..oo...",
  ".o.....",
];

const cache = new Map<string, RGB>();
const rgb = (color: string): RGB => {
  let c = cache.get(color);
  if (!c) cache.set(color, (c = hex(color)));
  return c;
};

class Stage {
  readonly pixels = new Uint8ClampedArray(STAGE_W * STAGE_H * 4);

  set(x: number, y: number, color: string, alpha = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= STAGE_W || y >= STAGE_H) return;
    const [r, g, b] = rgb(color);
    const i = (y * STAGE_W + x) * 4;
    this.pixels[i] = r;
    this.pixels[i + 1] = g;
    this.pixels[i + 2] = b;
    this.pixels[i + 3] = alpha;
  }

  sprite(sprite: Sprite, x: number, y: number, colors: Record<string, string>) {
    sprite.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const color = colors[row[dx]];
        if (color) this.set(x + dx, y + dy, color);
      }
    });
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, paint: (x: number, y: number, edge: boolean) => void) {
    const inside = (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (!inside(x, y)) continue;
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        paint(x, y, edge);
      }
    }
  }
}

/** Resolves a sprite palette key at cat coordinate (x, y) to a color. */
function colorFor(key: string, x: number, y: number, cat: CatConfig): string | null {
  const coat = COAT_COLORS[cat.coat];
  switch (key) {
    case "o":
      return coat.outline;
    case "f":
    case "p": {
      for (const [px, py, r, color] of coat.patches ?? []) {
        if ((x - px) ** 2 + (y - py) ** 2 <= r * r) return color;
      }
      return key === "f" ? coat.fur : coat.pattern;
    }
    case "l":
      return coat.light;
    case "i":
      return coat.innerEar;
    case "n":
      return SHARED.nose;
    case "e":
      return EYE_COLORS[cat.eyes][x >= CAT_SIZE / 2 ? 1 : 0];
    case "k":
      return SHARED.pupil;
    case "w":
      return SHARED.white;
    case "b":
      return SHARED.blush;
    case "r":
      return SHARED.demon;
    case "c":
    case "C":
    case "y": {
      if (cat.accessory === "none") return null;
      const [main, dark, detail] = ACCESSORY_COLORS[cat.accessory];
      return key === "c" ? main : key === "C" ? dark : detail;
    }
    default:
      return null;
  }
}

export function renderStage(input: StageInput): Uint8ClampedArray {
  const { cat, state, t, sincePet, sinceStretch, reducedMotion: still, scene } = input;
  const stage = new Stage();

  // Scene
  if (scene) {
    stage.ellipse(24, 39.5, 19, 4.2, (x, y, edge) =>
      stage.set(x, y, edge ? FX.cushionDark : y < 38 ? FX.cushionLight : FX.cushion),
    );
  } else {
    stage.ellipse(24, 38.5, 12, 1.6, (x, y) => stage.set(x, y, "#000000", 50));
  }

  // Cat
  const frame = catFrame(state, t, still, sinceStretch);
  const grid = rasterize(buildLayers(frame, cat.accessory));
  for (let y = 0; y < CAT_SIZE; y++) {
    for (let x = 0; x < CAT_SIZE; x++) {
      const color = colorFor(grid[y][x], x, y, cat);
      if (color) stage.set(CAT_X + x, CAT_Y + y, color);
    }
  }

  // Effects
  const headTop = CAT_Y + (frame.pose === "sit" ? 4 : frame.pose === "stretch" ? 13 : 10);

  if (state === "stretch" && sinceStretch < 1.4) {
    const spots = [
      [4, 14],
      [42, 12],
      [7, 30],
      [40, 28],
    ];
    spots.forEach(([x, y], i) => {
      if (still || Math.floor(t * 6 + i) % 2 === 0) stage.sprite(SPARK, x, y, { s: FX.spark });
    });
  }

  const heartsAge = Math.min(sincePet, state === "stretch" ? sinceStretch - 1.4 : Infinity);
  if (heartsAge >= 0 && heartsAge < Math.max(1.4, STRETCH_TIME - 1.4)) {
    const offsets = [-10, 9, -1];
    offsets.forEach((dx, i) => {
      const age = still ? 0.4 : heartsAge - i * 0.2;
      if (age < 0 || age > 1.2) return;
      const wobble = still ? 0 : Math.round(Math.sin(age * 9 + i) * 1);
      stage.sprite(HEART, 22 + dx + wobble, headTop - 4 - age * 9, { c: FX.heart });
    });
  }

  if (state === "sleeping") {
    for (let i = 0; i < 3; i++) {
      const p = still ? i / 3 : (t * 0.45 + i / 3) % 1;
      stage.sprite(ZED, 33 + p * 7, headTop + 2 - p * 14, { z: FX.zzz });
    }
  }

  if (state === "awaiting") {
    const bob = still ? 0 : Math.floor(t * 3) % 2;
    stage.sprite(BUBBLE, 35, 0 + bob, { o: FX.bubbleInk, w: FX.bubble, k: "#e05a47" });
  }

  return stage.pixels;
}
