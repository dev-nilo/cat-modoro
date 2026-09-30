"use client";

import { useState } from "react";

import type { Pomodoro } from "@/hooks/usePomodoro";
import { cleanName, type CatConfig } from "@/lib/cat/config";
import { notificationsSupported } from "@/lib/browser";
import { SETTING_LIMITS, type TimerSettings } from "@/lib/timer";

import CatCanvas from "./CatCanvas";
import CatCustomizer from "./CatCustomizer";
import Dialog from "./Dialog";

type Tab = "cat" | "timer";

const FIELDS: { key: keyof TimerSettings; label: string; unit: string }[] = [
  { key: "focusMinutes", label: "Focus", unit: "min" },
  { key: "shortBreakMinutes", label: "Short break", unit: "min" },
  { key: "longBreakMinutes", label: "Long break", unit: "min" },
  { key: "longBreakEvery", label: "Long break every", unit: "sessions" },
];

export default function SettingsDrawer({ open, onClose, pomo }: { open: boolean; onClose(): void; pomo: Pomodoro }) {
  const [tab, setTab] = useState<Tab>("cat");

  return (
    <Dialog open={open} onClose={onClose} title="Settings" variant="drawer">
      <div className="tabs" role="tablist">
        {(["cat", "timer"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`tab ${tab === t ? "tab-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "cat" ? "Cat" : "Timer"}
          </button>
        ))}
      </div>
      {tab === "cat" ? <CatTab pomo={pomo} /> : <TimerTab pomo={pomo} />}
    </Dialog>
  );
}

function CatTab({ pomo }: { pomo: Pomodoro }) {
  const [draft, setDraft] = useState<CatConfig>(pomo.cat!);
  const name = cleanName(draft.name);

  const change = (next: CatConfig) => {
    setDraft(next);
    // Apply live, but never persist an empty name.
    if (cleanName(next.name)) pomo.updateCat({ ...next, name: cleanName(next.name) });
  };

  return (
    <div className="tab-panel">
      <CatCanvas cat={{ ...draft, name: name || pomo.cat!.name }} state="idle" className="settings-preview" />
      <CatCustomizer value={draft} onChange={change} />
      {!name && <p className="hint-text">Your cat needs a name — keeping “{pomo.cat!.name}” for now.</p>}
    </div>
  );
}

function TimerTab({ pomo }: { pomo: Pomodoro }) {
  const [notifyError, setNotifyError] = useState("");

  return (
    <div className="tab-panel">
      <div className="number-fields">
        {FIELDS.map(({ key, label, unit }) => (
          <NumberField
            key={key}
            label={label}
            unit={unit}
            value={pomo.settings[key]}
            {...SETTING_LIMITS[key]}
            onChange={(v) => pomo.updateSettings({ [key]: v })}
          />
        ))}
      </div>
      <p className="hint-text">Changes apply right away. A session in progress keeps its remaining time.</p>

      <div className="toggles">
        <Toggle
          label="Sound"
          description="A little meow when a session ends"
          checked={pomo.prefs.sound}
          onChange={pomo.setSound}
        />
        {notificationsSupported() && (
          <Toggle
            label="Notifications"
            description="Get notified when you're in another tab or app"
            checked={pomo.prefs.notifications}
            onChange={async (on) => {
              const enabled = await pomo.setNotifications(on);
              setNotifyError(on && !enabled ? "Notifications are blocked. Allow them in your browser's site settings." : "");
            }}
          />
        )}
        {notifyError && (
          <p className="hint-text hint-warn" role="alert">
            {notifyError}
          </p>
        )}
      </div>
    </div>
  );
}

function NumberField(props: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange(v: number): void;
}) {
  const { label, unit, value, min, max, onChange } = props;
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(String(value));
  }

  const commit = (raw: string) => {
    const n = Math.round(Number(raw));
    if (raw.trim() === "" || !Number.isFinite(n)) return setText(String(value));
    const clamped = Math.min(max, Math.max(min, n));
    setText(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  return (
    <div className="number-field">
      <span className="field-label">{label}</span>
      <div className="stepper">
        <button type="button" onClick={() => commit(String(value - 1))} disabled={value <= min} aria-label={`Less ${label}`}>
          −
        </button>
        <input
          inputMode="numeric"
          value={text}
          aria-label={`${label} (${unit})`}
          onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit(e.currentTarget.value)}
        />
        <button type="button" onClick={() => commit(String(value + 1))} disabled={value >= max} aria-label={`More ${label}`}>
          +
        </button>
      </div>
      <span className="unit">{unit}</span>
    </div>
  );
}

function Toggle(props: { label: string; description: string; checked: boolean; onChange(on: boolean): void }) {
  return (
    <label className="toggle">
      <span>
        <span className="toggle-label">{props.label}</span>
        <span className="toggle-description">{props.description}</span>
      </span>
      <input type="checkbox" role="switch" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden />
    </label>
  );
}
