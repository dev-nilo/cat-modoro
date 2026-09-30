"use client";

import { useEffect, useRef, useState } from "react";

import type { Pomodoro } from "@/hooks/usePomodoro";

import CatCanvas from "./CatCanvas";
import Controls from "./Controls";
import { EnergyBar, PhasePill, TimeDisplay } from "./TimerPanel";

const CONFIRM_MS = 3000;

/** Contents of the always-on-top Picture-in-Picture window. */
export default function PipView({ pomo, win }: { pomo: Pomodoro; win: Window }) {
  const [armed, setArmed] = useState(false);
  const tick = useRef(pomo.tick);
  tick.current = pomo.tick;

  // The main tab may be in the background and throttled; this window is
  // visible, so its timers run on time and keep the countdown smooth.
  useEffect(() => {
    const id = win.setInterval(() => tick.current(), 250);
    return () => win.clearInterval(id);
  }, [win]);

  useEffect(() => {
    if (!armed) return;
    const id = win.setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => win.clearTimeout(id);
  }, [armed, win]);

  return (
    <div className="pip">
      <CatCanvas
        cat={pomo.cat!}
        state={pomo.catState}
        petAt={pomo.petAt}
        stretchAt={pomo.stretchAt}
        onPet={pomo.pet}
        scene={false}
        className="pip-stage"
      />
      <PhasePill timer={pomo.timer} />
      <TimeDisplay timer={pomo.timer} size="sm" />
      <EnergyBar energy={pomo.timer.energy} compact />
      <Controls
        pomo={pomo}
        compact
        resetLabel={armed ? "Sure?" : undefined}
        onReset={() => {
          // No room for a dialog here: the first click arms, the second resets.
          if (!armed) return setArmed(true);
          setArmed(false);
          pomo.reset();
        }}
      />
    </div>
  );
}
