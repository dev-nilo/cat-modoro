"use client";

import { useState } from "react";

import { cleanName, randomCat, type CatConfig } from "@/lib/cat/config";

import CatCanvas from "./CatCanvas";
import CatCustomizer from "./CatCustomizer";
import { DiceIcon, HeartIcon } from "./icons";

/** First visit: pick (or roll) a cat before the timer shows up. */
export default function Adoption({ onAdopt }: { onAdopt(cat: CatConfig): void }) {
  const [cat, setCat] = useState<CatConfig>(() => randomCat());
  const [petAt, setPetAt] = useState(-Infinity);
  const name = cleanName(cat.name);

  return (
    <main className="adoption">
      <header className="adoption-header">
        <p className="eyebrow">Pomodoro Cat</p>
        <h1>Adopt a focus buddy</h1>
        <p className="lede">
          Your cat gets tired while you work and recharges when you take breaks. Look after each other.
        </p>
      </header>

      <div className="adoption-grid">
        <div className="adoption-preview">
          <CatCanvas cat={cat} state="idle" petAt={petAt} onPet={() => setPetAt(Date.now())} className="stage" />
          <p className="cat-name">{name || "…"}</p>
        </div>

        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            if (name) onAdopt({ ...cat, name });
          }}
        >
          <CatCustomizer value={cat} onChange={setCat} />
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={() => setCat(randomCat())}>
              <DiceIcon /> Surprise me
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name}>
              <HeartIcon /> Adopt {name || "your cat"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
