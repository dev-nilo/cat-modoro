/** The user-facing customization options for the cat. */

export const COATS = [
  { id: "orangeTabby", label: "Orange tabby" },
  { id: "black", label: "Black" },
  { id: "white", label: "White" },
  { id: "gray", label: "Gray tabby" },
  { id: "tuxedo", label: "Tuxedo" },
  { id: "calico", label: "Calico" },
  { id: "snowshoe", label: "Snowshoe" },
] as const;

export const EYES = [
  { id: "amber", label: "Amber" },
  { id: "green", label: "Green" },
  { id: "blue", label: "Blue" },
  { id: "heterochromia", label: "Odd-eyed" },
] as const;

export const ACCESSORIES = [
  { id: "none", label: "None" },
  { id: "bellCollar", label: "Bell collar" },
  { id: "bow", label: "Bow" },
  { id: "beanie", label: "Beanie" },
  { id: "scarf", label: "Scarf" },
] as const;

export type CoatId = (typeof COATS)[number]["id"];
export type EyeId = (typeof EYES)[number]["id"];
export type AccessoryId = (typeof ACCESSORIES)[number]["id"];

export const NAME_MAX = 16;

export interface CatConfig {
  name: string;
  coat: CoatId;
  eyes: EyeId;
  accessory: AccessoryId;
}

const NAMES = ["Mochi", "Biscuit", "Pixel", "Nori", "Tofu", "Pumpkin", "Miso", "Luna", "Ziggy", "Olive", "Pudding", "Socks"];

const pick = <T>(list: readonly T[], random: () => number) => list[Math.floor(random() * list.length)];

export function randomCat(random: () => number = Math.random): CatConfig {
  return {
    name: pick(NAMES, random),
    coat: pick(COATS, random).id,
    eyes: pick(EYES, random).id,
    accessory: pick(ACCESSORIES, random).id,
  };
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX).trim();
}

/** Validates an untrusted object (e.g. from localStorage). Returns null if it isn't a usable cat. */
export function parseCat(input: unknown): CatConfig | null {
  if (!input || typeof input !== "object") return null;
  const c = input as Record<string, unknown>;
  const name = typeof c.name === "string" ? cleanName(c.name) : "";
  const coat = COATS.find((o) => o.id === c.coat)?.id;
  const eyes = EYES.find((o) => o.id === c.eyes)?.id;
  const accessory = ACCESSORIES.find((o) => o.id === c.accessory)?.id ?? "none";
  if (!name || !coat || !eyes) return null;
  return { name, coat, eyes, accessory };
}
