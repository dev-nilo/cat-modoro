"use client";

import { useId } from "react";

import { ACCESSORIES, COATS, EYES, NAME_MAX, type CatConfig } from "@/lib/cat/config";
import { COAT_COLORS, EYE_COLORS } from "@/lib/cat/palette";

interface Props {
  value: CatConfig;
  onChange(next: CatConfig): void;
}

/** Name + coat + eyes + accessory pickers. Radio groups styled as swatches. */
export default function CatCustomizer({ value, onChange }: Props) {
  const id = useId();
  const set = <K extends keyof CatConfig>(key: K, v: CatConfig[K]) => onChange({ ...value, [key]: v });

  return (
    <div className="customizer">
      <label className="field">
        <span className="field-label">Name</span>
        <input
          className="text-input"
          value={value.name}
          maxLength={NAME_MAX}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Give your cat a name"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <fieldset className="field">
        <legend className="field-label">Coat</legend>
        <div className="swatches">
          {COATS.map((coat) => {
            const c = COAT_COLORS[coat.id];
            const patch = c.patches?.[0]?.[3];
            const second = c.patches?.[1]?.[3];
            return (
              <label key={coat.id} className="swatch" title={coat.label}>
                <input
                  type="radio"
                  name={`${id}-coat`}
                  checked={value.coat === coat.id}
                  onChange={() => set("coat", coat.id)}
                />
                <span
                  className="swatch-chip coat-chip"
                  style={{
                    background: patch
                      ? `conic-gradient(${patch} 0 33%, ${c.fur} 0 66%, ${second} 0)`
                      : `linear-gradient(135deg, ${c.fur} 0 55%, ${c.points ?? (c.pattern === c.fur ? c.light : c.pattern)} 55%)`,
                    borderColor: c.outline,
                  }}
                />
                <span className="swatch-label">{coat.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="field-label">Eyes</legend>
        <div className="swatches">
          {EYES.map((eye) => {
            const [a, b] = EYE_COLORS[eye.id];
            return (
              <label key={eye.id} className="swatch" title={eye.label}>
                <input
                  type="radio"
                  name={`${id}-eyes`}
                  checked={value.eyes === eye.id}
                  onChange={() => set("eyes", eye.id)}
                />
                <span className="swatch-chip" style={{ background: `linear-gradient(90deg, ${a} 50%, ${b} 50%)` }} />
                <span className="swatch-label">{eye.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="field-label">Accessory</legend>
        <div className="chips">
          {ACCESSORIES.map((acc) => (
            <label key={acc.id} className="chip">
              <input
                type="radio"
                name={`${id}-acc`}
                checked={value.accessory === acc.id}
                onChange={() => set("accessory", acc.id)}
              />
              <span>{acc.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
