import type { Pomodoro } from "@/hooks/usePomodoro";

import { PauseIcon, PlayIcon, ResetIcon, SkipIcon } from "./icons";

interface Props {
  pomo: Pomodoro;
  onReset(): void;
  /** Overrides the reset button text (e.g. an inline "Sure?"). */
  resetLabel?: string;
  compact?: boolean;
}

export default function Controls({ pomo, onReset, resetLabel, compact = false }: Props) {
  const pausing = pomo.timer.running;
  const attention = pomo.timer.awaiting;
  return (
    <div className={`controls ${compact ? "controls-compact" : ""}`}>
      <button
        type="button"
        className={`btn btn-primary btn-main phase-${pomo.timer.awaiting ? nextPhaseClass(pomo) : pomo.timer.phase} ${attention ? "btn-attention" : ""}`}
        onClick={pomo.primary}
      >
        {pausing ? <PauseIcon /> : <PlayIcon />}
        {pomo.actionLabel}
      </button>
      <div className="controls-secondary">
        <button type="button" className="btn btn-secondary" onClick={pomo.skip} disabled={pomo.timer.awaiting}>
          <SkipIcon /> {compact ? <span className="sr-only">Skip</span> : "Skip"}
        </button>
        <button type="button" className={`btn ${resetLabel ? "btn-danger" : "btn-secondary"}`} onClick={onReset}>
          <ResetIcon /> {resetLabel ?? (compact ? <span className="sr-only">Reset</span> : "Reset")}
        </button>
      </div>
    </div>
  );
}

function nextPhaseClass(pomo: Pomodoro) {
  if (pomo.timer.phase !== "focus") return "focus";
  return pomo.nextBreakIsLong ? "longBreak" : "shortBreak";
}
