"use client";

import { useEffect, useRef } from "react";

import type { CatConfig } from "@/lib/cat/config";
import { renderStage, STAGE_H, STAGE_W } from "@/lib/cat/render";
import type { CatState } from "@/lib/cat/state";

interface Props {
  cat: CatConfig;
  state: CatState;
  /** Date.now() of the last pet / stretch start. */
  petAt?: number;
  stretchAt?: number;
  scene?: boolean;
  /** Called when the cat is clicked; omit for a purely decorative cat. */
  onPet?: () => void;
  className?: string;
}

/**
 * The animated cat. Renders a tiny 48x44 canvas and lets CSS scale it up
 * with `image-rendering: pixelated`. Animation runs on the canvas's own
 * window, so it keeps going inside the Picture-in-Picture window.
 */
export default function CatCanvas({
  cat,
  state,
  petAt = -Infinity,
  stretchAt = -Infinity,
  scene = true,
  onPet,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const props = useRef({ cat, state, petAt, stretchAt, scene });
  props.current = { cat, state, petAt, stretchAt, scene };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const win = canvas.ownerDocument.defaultView ?? window;
    const motion = win.matchMedia("(prefers-reduced-motion: reduce)");
    const image = ctx.createImageData(STAGE_W, STAGE_H);

    let frame = 0;
    const draw = () => {
      const p = props.current;
      const now = Date.now();
      image.data.set(
        renderStage({
          cat: p.cat,
          state: p.state,
          t: now / 1000,
          sincePet: (now - p.petAt) / 1000,
          sinceStretch: (now - p.stretchAt) / 1000,
          reducedMotion: motion.matches,
          scene: p.scene,
        }),
      );
      ctx.putImageData(image, 0, 0);
      frame = win.requestAnimationFrame(draw);
    };
    frame = win.requestAnimationFrame(draw);
    return () => win.cancelAnimationFrame(frame);
  }, []);

  const canvas = <canvas ref={canvasRef} width={STAGE_W} height={STAGE_H} className="cat-canvas" aria-hidden />;

  if (!onPet) return <div className={className}>{canvas}</div>;
  return (
    <button type="button" className={`cat-button ${className ?? ""}`} onClick={onPet} aria-label={`Pet ${cat.name}`}>
      {canvas}
    </button>
  );
}
