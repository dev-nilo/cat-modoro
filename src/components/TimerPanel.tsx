import { formatTime, PHASE_LABELS, type TimerSettings, type TimerState } from "@/lib/timer";

const SEGMENTS = 10;

export function PhasePill({ timer }: { timer: TimerState }) {
  const status = timer.awaiting ? "time's up" : timer.running ? null : "paused";
  return (
    <p className="phase-row">
      <span className={`phase-pill phase-${timer.phase}`}>{PHASE_LABELS[timer.phase]}</span>
      {status && <span className="phase-status">{status}</span>}
    </p>
  );
}

export function TimeDisplay({ timer, size = "lg" }: { timer: TimerState; size?: "lg" | "sm" }) {
  return (
    <p className={`time time-${size} ${timer.awaiting ? "time-up" : ""}`} aria-live="off">
      {formatTime(timer.remaining)}
    </p>
  );
}

export function energyLevel(energy: number): "high" | "mid" | "low" {
  return energy > 45 ? "high" : energy > 20 ? "mid" : "low";
}

export function EnergyBar({ energy, compact = false }: { energy: number; compact?: boolean }) {
  const filled = Math.ceil((energy / 100) * SEGMENTS - 1e-9);
  const pct = Math.round(energy);
  return (
    <div className={`energy ${compact ? "energy-compact" : ""}`}>
      {!compact && (
        <span className="meter-label">
          Energy <strong>{pct}%</strong>
        </span>
      )}
      <div
        className={`energy-bar energy-${energyLevel(energy)}`}
        role="meter"
        aria-label="Energy"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className={i < filled ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}

export function CycleDots({ timer, settings }: { timer: TimerState; settings: TimerSettings }) {
  const every = settings.longBreakEvery;
  const inSet = timer.cycles % every;
  const setComplete =
    timer.cycles > 0 && inSet === 0 && (timer.phase === "longBreak" || (timer.phase === "focus" && timer.awaiting));
  const filled = setComplete ? every : inSet;
  return (
    <div className="cycles">
      <span className="meter-label">
        Sessions <strong>{timer.cycles}</strong> today
      </span>
      <div className="cycle-dots" aria-label={`${filled} of ${every} sessions until a long break`} role="img">
        {Array.from({ length: every }, (_, i) => (
          <span key={i} className={i < filled ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}
