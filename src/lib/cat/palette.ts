/** Colors for every palette key, per coat / eye color / accessory. */

import type { AccessoryId, CoatId, EyeId } from "./config";

export type RGB = readonly [number, number, number];

export const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export interface Coat {
  outline: string;
  fur: string;
  pattern: string;
  light: string;
  innerEar: string;
  /** Color of the mask, ears, legs and tail; set only for pointed coats. */
  points?: string;
  /** Calico-style blobs recoloring fur pixels: [x, y, radius, color] in cat coordinates. */
  patches?: readonly [number, number, number, string][];
}

export const COAT_COLORS: Record<CoatId, Coat> = {
  orangeTabby: { outline: "#3a2219", fur: "#eb9a4a", pattern: "#c26a26", light: "#fbe6c8", innerEar: "#f4a7a3" },
  black: { outline: "#110d12", fur: "#3a3441", pattern: "#3a3441", light: "#4b4454", innerEar: "#8f6a78" },
  white: { outline: "#5a4b50", fur: "#f7f2ea", pattern: "#f7f2ea", light: "#ffffff", innerEar: "#f6b2bf" },
  gray: { outline: "#2b2a31", fur: "#9a9ea8", pattern: "#767a86", light: "#d7d9de", innerEar: "#e8a8b4" },
  tuxedo: { outline: "#110d12", fur: "#34303a", pattern: "#34303a", light: "#f7f3ee", innerEar: "#c98a98" },
  calico: {
    outline: "#4a3530",
    fur: "#f8f2e8",
    pattern: "#f8f2e8",
    light: "#ffffff",
    innerEar: "#f6b2bf",
    patches: [
      [11, 7, 4.5, "#e58b3a"],
      [23, 24, 4.2, "#3d3438"],
      [8, 25, 3.2, "#e58b3a"],
      [21, 9, 2.6, "#3d3438"],
    ],
  },
  snowshoe: {
    outline: "#3b2a24",
    fur: "#eee2cc",
    pattern: "#eee2cc",
    light: "#ffffff",
    innerEar: "#e9a3a8",
    points: "#6b5040",
  },
};

export const EYE_COLORS: Record<EyeId, readonly [string, string]> = {
  amber: ["#f2b53a", "#f2b53a"],
  green: ["#7ccf5e", "#7ccf5e"],
  blue: ["#6fb0f0", "#6fb0f0"],
  heterochromia: ["#6fb0f0", "#f2b53a"],
};

/** Main / dark / detail color for 'c', 'C', 'y'. */
export const ACCESSORY_COLORS: Record<Exclude<AccessoryId, "none">, readonly [string, string, string]> = {
  bellCollar: ["#d64545", "#9e2c2c", "#f2c14e"],
  bow: ["#ff7eb6", "#d94f8f", "#ff7eb6"],
  beanie: ["#4f9d9a", "#3b7c7a", "#fbf6ee"],
  scarf: ["#e2574c", "#f4d5a8", "#e2574c"],
};

export const SHARED = {
  nose: "#e8788f",
  pupil: "#1d1418",
  white: "#ffffff",
  blush: "#f78fae",
  demon: "#ff3b3b",
};

// Effects & scene
export const FX = {
  heart: "#ff6f91",
  heartDark: "#c93f65",
  zzz: "#8fb8ff",
  spark: "#ffd66b",
  bubble: "#fffaf2",
  bubbleInk: "#3b2a22",
  cushion: "#c65b4f",
  cushionDark: "#96413a",
  cushionLight: "#dd7d6f",
  shadow: "#00000033",
};
