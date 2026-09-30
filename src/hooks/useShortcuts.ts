"use client";

import { useEffect, useRef } from "react";

export interface ShortcutHandlers {
  primary(): void;
  skip(): void;
  /** Receives the window the key was pressed in (main or Picture-in-Picture). */
  reset(source: Window): void;
  pet(): void;
  help(source: Window): void;
}

export const SHORTCUTS: [string, string][] = [
  ["Space / Enter", "Start, pause or begin the next session"],
  ["S", "Skip the current session"],
  ["R", "Reset today's progress"],
  ["P", "Pet your cat"],
  ["?", "Show this help"],
];

const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const ACTIVATES_ON_KEY = new Set(["BUTTON", "A", "SUMMARY"]);

/** Global keyboard shortcuts, listening on every window passed (main + Picture-in-Picture). */
export function useShortcuts(handlers: ShortcutHandlers, windows: (Window | null)[]) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      if (TYPING.has(tag) || target?.isContentEditable) return;
      // A modal is open: let it handle the keyboard.
      if (target?.ownerDocument.querySelector("dialog[open]")) return;

      const h = ref.current;
      const source = target?.ownerDocument.defaultView ?? window;
      switch (e.key) {
        case " ":
        case "Enter":
          // Space/Enter on a focused button already clicks it.
          if (ACTIVATES_ON_KEY.has(tag)) return;
          h.primary();
          break;
        case "s":
        case "S":
          h.skip();
          break;
        case "r":
        case "R":
          h.reset(source);
          break;
        case "p":
        case "P":
          h.pet();
          break;
        case "?":
          h.help(source);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    const targets = windows.filter((w): w is Window => w !== null);
    targets.forEach((w) => w.addEventListener("keydown", onKey));
    return () => targets.forEach((w) => w.removeEventListener("keydown", onKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, windows);
}
