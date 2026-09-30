/**
 * Pixel-art cat, authored as grids of palette keys.
 *
 * Every sprite is a stack of layers on a 32x32 canvas. Symmetric parts are
 * written as their left half and mirrored. Keys are resolved to colors later
 * (render.ts), so every coat / eye color / accessory reuses the same pixels.
 *
 * Palette keys:
 *   .  transparent        o  outline           f  fur
 *   p  pattern (stripes)  l  light fur (muzzle, chest, paws)
 *   i  inner ear          n  nose / mouth      e  eye iris
 *   k  pupil              w  white highlight   b  blush
 *   r  demon eye          c/C/y  accessory colors (main / dark / detail)
 */

export const CAT_SIZE = 32;

export interface Layer {
  rows: readonly string[];
  x: number;
  y: number;
}

/** Mirrors 10/16-wide left halves into full symmetric rows. */
export function sym(halves: readonly string[]): string[] {
  return halves.map((h) => h + [...h].reverse().join(""));
}

/** Shifts the first `count` rows horizontally (for tail swishes). */
function shiftTop(rows: readonly string[], count: number, by: number): string[] {
  return rows.map((row, i) => {
    if (i >= count || by === 0) return row;
    return by > 0 ? ".".repeat(by) + row.slice(0, row.length - by) : row.slice(-by) + ".".repeat(-by);
  });
}

// ---------------------------------------------------------------------------
// Head (20 wide, 14 tall). Placed at x = HEAD_X, y = pose-specific.

export const HEAD_X = 6;

export const HEAD = sym([
  "....oooooo",
  "..ooffffff",
  ".offfffpfp",
  ".offfffpfp",
  "offfffffff",
  "offfffffff",
  "opffffffff",
  "opffffffff",
  "offfffflll",
  "offfflllll",
  ".offllllll",
  "..ofllllll",
  "...ooollll",
  "......oooo",
]);

export type Ears = "up" | "droop" | "back";

/** Ears, drawn behind the head. `dy` is relative to the head's top row. */
export const EARS: Record<Ears, { rows: string[]; dy: number }> = {
  up: {
    dy: -4,
    rows: sym([
      ".o........", //
      ".oo.......",
      ".oio......",
      ".oiio.....",
      ".oiifo....",
    ]),
  },
  droop: {
    dy: -2,
    rows: sym([
      "ooo.......", //
      "oiifo.....",
      ".oiifo....",
    ]),
  },
  back: {
    dy: -1,
    rows: sym([
      "oo........", //
      "ofoo......",
    ]),
  },
};

export type Eyes = "open" | "focus" | "tired" | "blink" | "happy" | "closed" | "grumpy" | "possessed";

/** Eye overlays in head coordinates; `dy` is the first row. */
export const EYES: Record<Eyes, { rows: string[]; dy: number }> = {
  open: {
    dy: 4,
    rows: sym(["....ooo...", "...oweeo..", "...oekeo..", "...oekeo..", "....ooo..."]),
  },
  focus: {
    dy: 5,
    rows: sym(["...ooooo..", "...oekeo..", "...oekeo..", "....ooo..."]),
  },
  tired: {
    dy: 6,
    rows: sym(["...ooooo..", "...oekeo..", "....ooo..."]),
  },
  blink: {
    dy: 7,
    rows: sym(["...ooooo.."]),
  },
  happy: {
    dy: 5,
    rows: sym(["....oo....", "...o..o..."]),
  },
  closed: {
    dy: 6,
    rows: sym(["...o..o...", "....oo...."]),
  },
  grumpy: {
    dy: 5,
    rows: sym(["...ooo....", "...oeeoo..", "...oekeo..", "....ooo..."]),
  },
  possessed: {
    dy: 4,
    rows: sym(["....ooo...", "...orrro..", "...orkro..", "...orkro..", "....ooo..."]),
  },
};

export type Mouth = "smile" | "flat" | "meow" | "tired" | "frown" | "fangs" | "none";

/** Mouth overlays (nose included) in head coordinates, starting at row 9. */
export const MOUTHS: Record<Mouth, string[]> = {
  smile: sym([".........n", ".......o..", "........oo"]),
  flat: sym([".........n", "........oo"]),
  meow: sym([".........n", "........oo", ".......onn", "........oo"]),
  tired: sym([".........n", "..........", "........oo"]),
  frown: sym([".........n", "........oo", ".......o.."]),
  fangs: sym([".........n", ".......ooo", "........wo"]),
  none: sym([".........n"]),
};
const MOUTH_DY = 9;

const BLUSH = sym(["...bb....."]);
const BLUSH_DY = 9;

// ---------------------------------------------------------------------------
// Bodies (full 32-wide rows from 16-wide halves).

export type Pose = "sit" | "loaf" | "sleep" | "stretch";

const SIT_BODY: Layer = {
  x: 0,
  y: 16,
  rows: sym([
    "........offfffff",
    "........offfffff",
    ".......offffffff",
    ".......offffflll",
    "......offfffllll",
    "......oppfffllll",
    "......offfffllll",
    ".....offffffllll",
    ".....offppffllll",
    ".....offffffllll",
    ".....offffffllll",
    ".....offffffllll",
    ".....offfffolllo",
    ".....offfffolllo",
    "......oooooooooo",
  ]),
};

const LOAF_BODY: Layer = {
  x: 0,
  y: 17,
  rows: sym([
    "........offfffff",
    "......offfffffff",
    "....offfffffffff",
    "...o" + "f".repeat(12),
    "..offfffffffffff",
    "..offpffffffffff",
    ".offfpffffffllll",
    ".offffpfffflllll",
    ".o" + "f".repeat(9) + "l".repeat(5),
    ".o" + "f".repeat(9) + "l".repeat(5),
    ".offfffffffolllo",
    "..offffffffolllo",
    "...ooooooooooooo",
  ]),
};

const STRETCH_HUMP: Layer = {
  x: 0,
  y: 5,
  rows: sym([
    "..........oooooo",
    "........ooffffff",
    ".......offffffff",
    "......offpffpfff",
    "......offfffffff",
    ".....offfpffpfff",
    ".....offffffffff",
    ".....offffffffff",
    ".....offffffffff",
    ".....offffffffff",
  ]),
};

/** Front legs reaching forward, drawn between the hump and the head. */
const STRETCH_LEGS: Layer = {
  x: 0,
  y: 14,
  rows: sym([
    ".....oo.........",
    "....offo........",
    "....offo........",
    "...offfo........",
    "...offo.........",
    "...offo.........",
    "..offfo.........",
    "..offo..........",
    "..offo..........",
    "..offo..........",
    "..offo..........",
    "..offo..........",
    "..offoooo.......",
    "..offlllo.......",
    "..olllllo.......",
    "...ooooo........",
  ]),
};

// ---------------------------------------------------------------------------
// Tails. Each returns a layer for a given swish offset (-1, 0, 1).

const SIT_TAIL = [
  "......oo..",
  ".....ofo..",
  ".....ofo..",
  ".....opo..",
  ".....ofo..",
  ".....ofo..",
  "....ofo...",
  "...opfo...",
  ".oofffo...",
  "offfoo....",
  "oooo......",
];

const PUFFY_TAIL = [
  ".....ooo..",
  "....offfo.",
  "....ofpfo.",
  "....offfo.",
  "....ofpfo.",
  "....offfo.",
  "....offfo.",
  "...offfo..",
  "..opffo...",
  ".offffo...",
  "offfoo....",
  "oooo......",
];

/** Wraps around the front of the loaf; the tip curls up on the left. */
const LOAF_TAIL = [
  ".oo.........", //
  "ofo.........",
  "ofpoooooooo.",
  ".offfpfffpfo",
  "..oooooooooo",
];

const STRETCH_TAIL = [
  "...oo", //
  "..ofo",
  "..ofo",
  ".opo.",
  ".ofo.",
  ".ofo.",
];

export type Tail = "sit" | "puffy" | "loaf" | "stretch" | "none";

export function tailLayer(tail: Tail, swish: number): Layer | null {
  switch (tail) {
    case "sit":
      return { x: 22, y: 19, rows: shiftTop(SIT_TAIL, 3, swish) };
    case "puffy":
      return { x: 22, y: 18, rows: shiftTop(PUFFY_TAIL, 2, swish) };
    case "loaf":
      return { x: 20, y: 25, rows: shiftTop(LOAF_TAIL, 2, swish) };
    case "stretch":
      return { x: 18, y: 0, rows: shiftTop(STRETCH_TAIL, 3, swish) };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Accessories, in head coordinates (20 wide).

export type AccessoryShape = "bellCollar" | "bow" | "beanie" | "scarf";

export const ACCESSORY_LAYERS: Record<AccessoryShape, { rows: string[]; dy: number; front: boolean }> = {
  bellCollar: {
    dy: 13,
    front: true,
    rows: [
      ".....cccccccccc.....", //
      "........oyyo........",
      "........oyyo........",
      ".........oo.........",
    ],
  },
  bow: {
    dy: -1,
    front: true,
    rows: [
      ".............cc.cc..", //
      ".............cCCCc..",
      ".............cc.cc..",
    ],
  },
  beanie: {
    dy: -4,
    front: true,
    rows: sym([
      ".........y", //
      "......cccc",
      "....cccccc",
      "...ccccccc",
      "..cccccccc",
      "..CCCCCCCC",
    ]),
  },
  scarf: {
    dy: 12,
    front: true,
    rows: [
      "...cccccccccccccc...",
      "..cCcCcCcCcCcCcCc...",
      "...cc...............",
      "...cC...............",
      "...cc...............",
    ],
  },
};

// ---------------------------------------------------------------------------
// Composition

export interface CatFrame {
  pose: Pose;
  /** Extra vertical offset of the head (breathing). */
  headBob: number;
  ears: Ears;
  eyes: Eyes;
  mouth: Mouth;
  blush: boolean;
  tail: Tail;
  swish: number;
}

const HEAD_Y: Record<Pose, number> = { sit: 4, loaf: 9, sleep: 11, stretch: 13 };

/** Builds the ordered layer stack (back to front) for one frame. */
export function buildLayers(frame: CatFrame, accessory: AccessoryShape | "none"): Layer[] {
  const layers: Layer[] = [];
  const headY = HEAD_Y[frame.pose] + frame.headBob;
  const head = (rows: readonly string[], dy: number): Layer => ({ rows, x: HEAD_X, y: headY + dy });
  const tail = tailLayer(frame.tail, frame.swish);

  if (frame.pose === "sit") {
    if (tail) layers.push(tail);
    layers.push(SIT_BODY);
  } else if (frame.pose === "stretch") {
    if (tail) layers.push(tail);
    layers.push(STRETCH_HUMP, STRETCH_LEGS);
  } else {
    layers.push(LOAF_BODY);
    if (tail) layers.push(tail);
  }

  const ears = EARS[frame.ears];
  layers.push(head(ears.rows, ears.dy));
  layers.push(head(HEAD, 0));

  const eyes = EYES[frame.eyes];
  layers.push(head(eyes.rows, eyes.dy));
  layers.push(head(MOUTHS[frame.mouth], MOUTH_DY));
  if (frame.blush) layers.push(head(BLUSH, BLUSH_DY));

  if (accessory !== "none") {
    const acc = ACCESSORY_LAYERS[accessory];
    layers.push(head(acc.rows, acc.dy));
  }
  return layers;
}

/** Flattens layers into a CAT_SIZE x CAT_SIZE grid of palette keys ('.' = empty). */
export function rasterize(layers: readonly Layer[], size = CAT_SIZE): string[][] {
  const grid = Array.from({ length: size }, () => Array<string>(size).fill("."));
  for (const layer of layers) {
    layer.rows.forEach((row, dy) => {
      const y = layer.y + dy;
      if (y < 0 || y >= size) return;
      for (let dx = 0; dx < row.length; dx++) {
        const key = row[dx];
        const x = layer.x + dx;
        if (key !== "." && x >= 0 && x < size) grid[y][x] = key;
      }
    });
  }
  return grid;
}

/** Every static grid, for validation in tests. */
export const ALL_GRIDS: Record<string, readonly string[]> = {
  head: HEAD,
  sitBody: SIT_BODY.rows,
  loafBody: LOAF_BODY.rows,
  stretchHump: STRETCH_HUMP.rows,
  stretchLegs: STRETCH_LEGS.rows,
  sitTail: SIT_TAIL,
  puffyTail: PUFFY_TAIL,
  loafTail: LOAF_TAIL,
  stretchTail: STRETCH_TAIL,
  blush: BLUSH,
  ...Object.fromEntries(Object.entries(EARS).map(([k, v]) => [`ears.${k}`, v.rows])),
  ...Object.fromEntries(Object.entries(EYES).map(([k, v]) => [`eyes.${k}`, v.rows])),
  ...Object.fromEntries(Object.entries(MOUTHS).map(([k, v]) => [`mouth.${k}`, v])),
  ...Object.fromEntries(Object.entries(ACCESSORY_LAYERS).map(([k, v]) => [`accessory.${k}`, v.rows])),
};
