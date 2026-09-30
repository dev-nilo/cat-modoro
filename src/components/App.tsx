"use client";

import { usePomodoro } from "@/hooks/usePomodoro";

import Adoption from "./Adoption";
import Home from "./Home";

export default function App() {
  const pomo = usePomodoro();

  // Saved state lives in localStorage, so nothing meaningful can render on the server.
  if (!pomo) {
    return (
      <main className="splash" aria-busy>
        <p>Waking your cat up…</p>
      </main>
    );
  }
  if (!pomo.cat) return <Adoption onAdopt={pomo.adopt} />;
  return <Home pomo={pomo} />;
}
