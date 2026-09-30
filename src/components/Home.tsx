"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import type { Pomodoro } from "@/hooks/usePomodoro";
import { SHORTCUTS, useShortcuts } from "@/hooks/useShortcuts";
import { openPipWindow, pipSupported } from "@/lib/browser";
import { STATE_CAPTIONS } from "@/lib/cat/state";

import CatCanvas from "./CatCanvas";
import Controls from "./Controls";
import Dialog from "./Dialog";
import { GearIcon, HelpIcon, PopOutIcon } from "./icons";
import PipView from "./PipView";
import SettingsDrawer from "./SettingsDrawer";
import { CycleDots, EnergyBar, PhasePill, TimeDisplay } from "./TimerPanel";

const PIP_SIZE = { width: 260, height: 330 };

export default function Home({ pomo }: { pomo: Pomodoro }) {
  const cat = pomo.cat!;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pip, setPip] = useState<Window | null>(null);
  const [canPip, setCanPip] = useState(false);

  useEffect(() => setCanPip(pipSupported()), []);

  useEffect(() => {
    if (!pip) return;
    const onClose = () => setPip(null);
    pip.addEventListener("pagehide", onClose);
    return () => pip.removeEventListener("pagehide", onClose);
  }, [pip]);

  const popOut = async () => {
    if (pip) return pip.focus();
    try {
      setPip(await openPipWindow(PIP_SIZE.width, PIP_SIZE.height));
    } catch {
      // User dismissed or the browser refused (e.g. not triggered by a click).
    }
  };

  const askReset = () => setConfirmReset(true);

  useShortcuts(
    {
      primary: pomo.primary,
      skip: () => !pomo.timer.awaiting && pomo.skip(),
      // Dialogs live in the main window; from the floating window they'd open out of sight.
      reset: (source) => source === window && askReset(),
      pet: pomo.pet,
      help: (source) => source === window && setHelpOpen(true),
    },
    [typeof window === "undefined" ? null : window, pip],
  );

  const caption = STATE_CAPTIONS[pomo.catState](cat.name);

  return (
    <div className="app">
      <header className="topbar">
        <p className="brand">
          <span aria-hidden>🐾</span> Pomodoro Cat
        </p>
        <nav className="topbar-actions" aria-label="App">
          {canPip && (
            <button type="button" className="icon-button" onClick={popOut} title="Float over other windows">
              <PopOutIcon />
              <span className="icon-button-text">{pip ? "Floating" : "Pop out"}</span>
            </button>
          )}
          <button type="button" className="icon-button" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts">
            <HelpIcon />
          </button>
          <button type="button" className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <GearIcon />
          </button>
        </nav>
      </header>

      <main className="home">
        <section className="cat-area" aria-label={cat.name}>
          {pip ? (
            <div className="cat-away">
              <p>{cat.name} is floating in a little window.</p>
              <button type="button" className="btn btn-secondary" onClick={() => pip.close()}>
                Bring {cat.name} back
              </button>
            </div>
          ) : (
            <CatCanvas
              cat={cat}
              state={pomo.catState}
              petAt={pomo.petAt}
              stretchAt={pomo.stretchAt}
              onPet={pomo.pet}
              className="stage"
            />
          )}
          <h1 className="cat-name">{cat.name}</h1>
          <p className="caption" aria-live="polite">
            {caption}
          </p>
        </section>

        <section className="card timer-card" aria-label="Timer">
          <PhasePill timer={pomo.timer} />
          <TimeDisplay timer={pomo.timer} />
          <div className="meters">
            <EnergyBar energy={pomo.timer.energy} />
            <CycleDots timer={pomo.timer} settings={pomo.settings} />
          </div>
          <Controls pomo={pomo} onReset={askReset} />
        </section>
      </main>

      <footer className="footer">
        Press <kbd>?</kbd> for shortcuts · click {cat.name} for pets
      </footer>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} pomo={pomo} />

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard shortcuts">
        <dl className="shortcuts">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys}>
              <dt>
                {keys.split(" / ").map((k, i) => (
                  <span key={k}>
                    {i > 0 && " / "}
                    <kbd>{k}</kbd>
                  </span>
                ))}
              </dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </Dialog>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset today's progress?">
        <p className="dialog-text">
          This clears today&apos;s sessions and sets {cat.name}&apos;s energy back to the start. Your settings and your
          cat stay the same.
        </p>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(false)} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              pomo.reset();
              setConfirmReset(false);
            }}
          >
            Reset
          </button>
        </div>
      </Dialog>

      {pip && createPortal(<PipView pomo={pomo} win={pip} />, pip.document.body)}
    </div>
  );
}
