"use client";

import { JetBrains_Mono } from "next/font/google";
import { useEffect, useRef } from "react";

import { PomodoroPet as Pet } from "@/lib/pet";
import { HEIGHT, PetView, WIDTH } from "@/lib/view";

const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"] });

const CSS_SCALE = 2; // tamanho na pagina = WIDTH x HEIGHT logicos * CSS_SCALE

/**
 * Ponte entre o navegador e PetView: loop com requestAnimationFrame, mouse,
 * toque e teclado. Todo o estado vive em PetView; o React so monta o canvas.
 *
 *   Clique ............. botao de acao (iniciar / pausar / comecar fase)
 *   Clique direito ..... nova sessao (reset)
 *   ESPACO / ENTER ..... botao de acao
 *   S .................. pular fase
 *   R .................. reset
 *
 * Query string `?demo` usa ciclos curtos (6 s de foco / 4 s de pausa).
 */
export default function PomodoroPet() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const demo = new URLSearchParams(window.location.search).has("demo");
    const view = new PetView({
      fontFamily: mono.style.fontFamily,
      ...(demo ? { focusDuration: 6, breakDuration: 4 } : {}),
    });
    if (demo) view.pet.start();
    let scale = 1;
    const resize = () => {
      scale = CSS_SCALE * (window.devicePixelRatio || 1);
      canvas.width = WIDTH * scale;
      canvas.height = HEIGHT * scale;
    };
    resize();

    const toLogical = (e: PointerEvent | MouseEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * WIDTH, ((e.clientY - r.top) / r.height) * HEIGHT];
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") view.hovering = true;
      view.mouse = toLogical(e);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      view.hovering = false;
      view.mouse = null;
    };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // Sem hover no toque: o primeiro toque so expande o painel.
      if (e.pointerType !== "mouse" && !view.expanded) {
        view.hovering = true;
        return;
      }
      view.click(...toLogical(e));
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      view.reset();
    };
    const onOutside = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.target !== canvas) view.hovering = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === " " || e.key === "Enter") view.primaryAction();
      else if (e.key === "s" || e.key === "S") view.skip();
      else if (e.key === "r" || e.key === "R") view.reset();
      else return;
      e.preventDefault();
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("pointerdown", onOutside);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", resize);

    // Com a aba em segundo plano o rAF para; ao voltar, o dt grande
    // "alcanca" o tempo perdido (tick() ja trata o excesso).
    let frame = 0;
    let last = performance.now();
    let title = "";
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      view.update(dt);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      view.draw(ctx, now / 1000);
      canvas.style.opacity = view.opacity.toFixed(3);

      const next = `${Pet.formatTime(view.pet.remaining)} · ${view.pet.phaseLabel}`;
      if (next !== title) document.title = title = next;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerdown", onOutside);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Pomodoro Pet: timer com um monstrengo que cansa no foco e se recupera na pausa"
      role="img"
      style={{
        width: WIDTH * CSS_SCALE,
        maxWidth: "100%",
        aspectRatio: `${WIDTH} / ${HEIGHT}`,
        height: "auto",
        cursor: "pointer",
        touchAction: "manipulation",
        userSelect: "none",
      }}
    />
  );
}
