import PomodoroPet from "@/components/PomodoroPet";

export default function Home() {
  return (
    <main>
      <PomodoroPet />
      <p className="hint">
        passe o mouse para abrir o painel · <kbd>espaço</kbd> iniciar/pausar · <kbd>S</kbd> pular ·{" "}
        <kbd>R</kbd> reset
      </p>
    </main>
  );
}
