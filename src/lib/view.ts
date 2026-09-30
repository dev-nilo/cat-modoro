/**
 * Camada de apresentacao do Pomodoro-Tamagotchi: pixel art em <canvas>.
 *
 * O monstrengo e desenhado em tempo real (sem sprites externos) numa
 * superficie 64x64 e ampliado com nearest-neighbor. Ele comeca fofo e vai
 * virando um demoniozinho conforme o cansaco aumenta: chifres crescem, os olhos
 * ficam afiados, a boca vira um grin com presas e nasce uma cauda pontuda.
 *
 * PetView nao conhece React nem o DOM da pagina: recebe um contexto 2D ja
 * escalado para o espaco logico WIDTH x HEIGHT e eventos em coordenadas
 * logicas. O componente PomodoroPet.tsx faz a ponte com o navegador.
 */

import {
  BREAK,
  BREAK_DONE,
  BREAK_STARTED,
  FOCUS,
  FOCUS_DONE,
  PomodoroPet,
  type PetOptions,
} from "./pet";

export const WIDTH = 240;
export const HEIGHT = 168;

export const SPRITE = 64; // resolucao logica do bichinho (pixel art)
export const SCALE = 2; // ampliacao com nearest-neighbor

export const REVEAL_SPEED = 6.0; // velocidade da transicao compacto <-> expandido
export const ALPHA_IDLE = 120; // opacidade no repouso (0-255)
export const ALPHA_ACTIVE = 240; // opacidade com o mouse em cima
export const REVEAL_THRESHOLD = 0.4;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Point = [number, number];
export type Color = [number, number, number];

// Layout compacto (so bichinho + timer)
export const COMPACT_PET: Point = [62, 88];
export const COMPACT_TIMER: Point = [178, 88];

// Layout expandido (painel com tudo)
export const PANEL_RECT: Rect = { x: 3, y: 3, w: WIDTH - 6, h: HEIGHT - 6 };
export const EXPANDED_PET: Point = [50, 88];
export const EXPANDED_TIMER: Point = [168, 50];
export const ENERGY_BAR: Rect = { x: 104, y: 80, w: 116, h: 11 };
export const CYCLES_Y = 102;
export const BTN_MAIN: Rect = { x: 104, y: 112, w: 120, h: 22 };
export const BTN_SKIP: Rect = { x: 104, y: 138, w: 58, h: 20 };
export const BTN_RESET: Rect = { x: 166, y: 138, w: 58, h: 20 };

// Paleta
export const BG: Color = [26, 28, 35];
export const PANEL: Color = [40, 43, 53];
export const TEXT: Color = [236, 239, 246];
export const MUTED: Color = [140, 148, 166];
export const FOCUS_ACCENT: Color = [255, 96, 96];
export const BREAK_ACCENT: Color = [86, 220, 140];
const EYE_WHITE: Color = [250, 250, 253];
const INK: Color = [30, 22, 38]; // contorno do bichinho
const DEMON_EYE: Color = [255, 214, 96];
const SWEAT: Color = [150, 205, 255];
const SPARK: Color = [255, 226, 120];
const TOOTH: Color = [250, 250, 255];
const WHITE: Color = [255, 255, 255];
const DARK_TEXT: Color = [20, 22, 28];

// Cores da energia: 0.0 = exausto/demonio, 1.0 = fofo
export const ENERGY_STOPS: [number, Color][] = [
  [0.0, [168, 40, 62]],
  [0.25, [216, 92, 74]],
  [0.55, [238, 170, 100]],
  [1.0, [122, 214, 150]],
];

export const JOY_TIME = 1.8;
export const ALERT_TIME = 1.6;

export type Expression = "focus" | "happy" | "ok" | "tired" | "exhausted" | "resting";

// --- helpers ---
export function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mix(c1: Color, c2: Color, t: number): Color {
  return c1.map((a, i) => Math.round(a + (c2[i] - a) * t)) as Color;
}

export function shade(color: Color, factor: number): Color {
  return color.map((c) => Math.round(c * factor)) as Color;
}

export function energyColor(energy: number): Color {
  const level = clamp(energy / 100, 0, 1);
  for (let i = 0; i < ENERGY_STOPS.length - 1; i++) {
    const [p0, c0] = ENERGY_STOPS[i];
    const [p1, c1] = ENERGY_STOPS[i + 1];
    if (level <= p1) {
      const span = p1 - p0 || 1;
      return mix(c0, c1, (level - p0) / span);
    }
  }
  return ENERGY_STOPS[ENERGY_STOPS.length - 1][1];
}

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

const rgb = (c: Color) => `rgb(${c[0]},${c[1]},${c[2]})`;
const int = Math.trunc;
const floorDiv = (a: number, b: number) => Math.floor(a / b);

/** Rect w x h com centro em (cx, cy), com aritmetica inteira. */
function centered(w: number, h: number, cx: number, cy: number): Rect {
  return { x: cx - floorDiv(w, 2), y: cy - floorDiv(h, 2), w, h };
}

// --- primitivas (coordenadas em pixels; +0.5 = centro do pixel) ---
type Ctx = CanvasRenderingContext2D;

function fillCircle(ctx: Ctx, color: Color, x: number, y: number, r: number) {
  ctx.fillStyle = rgb(color);
  ctx.beginPath();
  ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2);
  ctx.fill();
}

function strokeCircle(ctx: Ctx, color: Color, x: number, y: number, r: number, width: number) {
  ctx.strokeStyle = rgb(color);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x + 0.5, y + 0.5, r - width / 2, 0, Math.PI * 2);
  ctx.stroke();
}

function ellipsePath(ctx: Ctx, r: Rect, inset = 0) {
  ctx.beginPath();
  ctx.ellipse(
    r.x + r.w / 2,
    r.y + r.h / 2,
    Math.max(0, r.w / 2 - inset),
    Math.max(0, r.h / 2 - inset),
    0,
    0,
    Math.PI * 2,
  );
}

function fillEllipse(ctx: Ctx, color: Color, r: Rect) {
  ctx.fillStyle = rgb(color);
  ellipsePath(ctx, r);
  ctx.fill();
}

function strokeEllipse(ctx: Ctx, color: Color, r: Rect, width = 1) {
  ctx.strokeStyle = rgb(color);
  ctx.lineWidth = width;
  ellipsePath(ctx, r, width / 2);
  ctx.stroke();
}

function polyline(ctx: Ctx, color: Color, points: Point[], width: number) {
  ctx.strokeStyle = rgb(color);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x + 0.5, y + 0.5) : ctx.moveTo(x + 0.5, y + 0.5)));
  ctx.stroke();
}

function polygon(ctx: Ctx, color: Color, points: Point[], width = 0) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x + 0.5, y + 0.5) : ctx.moveTo(x + 0.5, y + 0.5)));
  ctx.closePath();
  if (width) {
    ctx.strokeStyle = rgb(color);
    ctx.lineWidth = width;
    ctx.stroke();
  } else {
    ctx.fillStyle = rgb(color);
    ctx.fill();
  }
}

function fillRect(ctx: Ctx, color: Color, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = rgb(color);
  ctx.fillRect(x, y, w, h);
}

function roundRect(ctx: Ctx, r: Rect, radius: number, fill: Color | null, stroke?: Color, width = 1) {
  if (fill) {
    ctx.fillStyle = rgb(fill);
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, radius);
    ctx.fill();
  }
  if (stroke) {
    const i = width / 2;
    ctx.strokeStyle = rgb(stroke);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.roundRect(r.x + i, r.y + i, r.w - width, r.h - width, Math.max(0, radius - i));
    ctx.stroke();
  }
}

/** Remove o antialias do contorno: cada pixel fica 100% opaco ou transparente. */
function snapAlpha(ctx: Ctx, size: number) {
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 110 ? 255 : 0;
  ctx.putImageData(image, 0, 0);
}

export interface SpriteCanvas {
  width: number;
  height: number;
  getContext(kind: "2d", options?: CanvasRenderingContext2DSettings): Ctx | null;
}

export interface ViewOptions extends PetOptions {
  fontFamily?: string;
  /** Fabrica da superficie do sprite (injetavel para testes). */
  createCanvas?: (w: number, h: number) => SpriteCanvas;
}

function defaultCanvas(w: number, h: number): SpriteCanvas {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export class PetView {
  readonly pet: PomodoroPet;

  joy = 0; // animacao de alegria ao comecar a pausa
  alert = 0; // pulso quando uma fase termina
  reveal = 0; // 0 = compacto, 1 = expandido
  hovering = false;
  mouse: Point | null = null;
  look: Point = [0, 0];

  private readonly font: string;
  private readonly sprite: SpriteCanvas;
  private readonly spriteCtx: Ctx;

  constructor({ fontFamily = "ui-monospace, Consolas, monospace", createCanvas, ...petOptions }: ViewOptions = {}) {
    this.pet = new PomodoroPet(petOptions);
    this.font = fontFamily;
    this.sprite = (createCanvas ?? defaultCanvas)(SPRITE, SPRITE);
    this.spriteCtx = this.sprite.getContext("2d", { willReadFrequently: true })!;
  }

  get expanded(): boolean {
    return this.reveal > REVEAL_THRESHOLD;
  }

  /** Opacidade atual (0..1): baixa em repouso, alta com o mouse em cima. */
  get opacity(): number {
    return lerp(ALPHA_IDLE, ALPHA_ACTIVE, this.reveal) / 255;
  }

  petCenter(): Point {
    return this.expanded ? EXPANDED_PET : COMPACT_PET;
  }

  petRect(): Rect {
    const size = SPRITE * SCALE;
    const [cx, cy] = this.petCenter();
    return { x: cx - floorDiv(size, 2), y: cy - floorDiv(size, 2), w: size, h: size };
  }

  // --- acoes ---
  /** Botao unico: inicia/pausa ou marca o inicio da proxima fase. */
  primaryAction(): void {
    if (this.pet.toggle() === BREAK_STARTED) this.joy = JOY_TIME;
  }

  skip(): void {
    const event = this.pet.skip();
    if (event === FOCUS_DONE || event === BREAK_DONE) this.alert = ALERT_TIME;
  }

  reset(): void {
    this.pet.reset();
  }

  /** Clique esquerdo em coordenadas logicas. */
  click(x: number, y: number): void {
    if (!this.expanded) {
      this.primaryAction();
      return;
    }
    if (contains(BTN_SKIP, x, y)) this.skip();
    else if (contains(BTN_RESET, x, y)) this.reset();
    else if (contains(BTN_MAIN, x, y) || contains(this.petRect(), x, y)) this.primaryAction();
  }

  // --- simulacao ---
  update(dt: number): void {
    for (const event of this.pet.tick(dt)) {
      if (event === FOCUS_DONE || event === BREAK_DONE) this.alert = ALERT_TIME;
    }
    this.joy = Math.max(0, this.joy - dt);
    this.alert = Math.max(0, this.alert - dt);

    const target = this.hovering ? 1 : 0;
    const step = REVEAL_SPEED * dt;
    this.reveal =
      this.reveal < target ? Math.min(target, this.reveal + step) : Math.max(target, this.reveal - step);

    if (this.mouse) {
      const [cx, cy] = this.petCenter();
      const [mx, my] = this.mouse;
      this.look = [clamp((mx - cx) / (WIDTH / 2), -1, 1), clamp((my - cy) / (HEIGHT / 2), -1, 1)];
    } else {
      this.look = [0, 0];
    }
  }

  // --- expressoes ---
  expression(): Expression {
    if (this.joy > 0) return "happy";
    if (this.pet.phase === BREAK && this.pet.running) {
      return this.pet.energy >= 70 ? "happy" : "resting";
    }
    return this.pet.mood;
  }

  actionLabel(): string {
    const p = this.pet;
    if (p.awaiting) return p.phase === FOCUS ? "começar pausa" : "iniciar foco";
    if (p.running) return "pausar";
    if (p.progress > 0) return "retomar";
    return p.phase === FOCUS ? "iniciar foco" : "iniciar pausa";
  }

  statusLabel(): string {
    if (this.pet.awaiting) return "aguardando";
    return this.pet.running ? "rodando" : "pausado";
  }

  /** 0 = fofinho, 1 = demoniozinho. Demoniza conforme a energia cai. */
  menace(): number {
    return clamp((0.7 - this.pet.energy / 100) / 0.7, 0, 1);
  }

  accent(): Color {
    return this.pet.phase === BREAK ? BREAK_ACCENT : FOCUS_ACCENT;
  }

  private timerColor(): Color {
    return this.pet.awaiting ? this.accent() : TEXT;
  }

  // --- desenho ---
  /** Desenha um quadro. `ctx` ja deve estar escalado para WIDTH x HEIGHT; `t` em segundos. */
  draw(ctx: Ctx, t: number): void {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (this.expanded) this.drawExpanded(ctx, t);
    else this.drawCompact(ctx, t);
  }

  private text(
    ctx: Ctx,
    str: string,
    x: number,
    y: number,
    size: number,
    color: Color,
    { bold = false, align = "center" as CanvasTextAlign, baseline = "middle" as CanvasTextBaseline } = {},
  ) {
    ctx.font = `${bold ? "700" : "400"} ${size}px ${this.font}`;
    ctx.fillStyle = rgb(color);
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(str, x, y);
  }

  private drawCompact(ctx: Ctx, t: number) {
    this.drawPet(ctx, t, ...COMPACT_PET);
    this.text(ctx, PomodoroPet.formatTime(this.pet.remaining), ...COMPACT_TIMER, 34, this.timerColor(), {
      bold: true,
    });
    if (this.alert > 0) this.drawAlert(ctx, t, COMPACT_PET[0], COMPACT_PET[1] - 58);
  }

  private drawExpanded(ctx: Ctx, t: number) {
    roundRect(ctx, PANEL_RECT, 10, PANEL, shade(PANEL, 1.6), 2);

    ctx.font = `700 12px ${this.font}`;
    const labelW = Math.ceil(ctx.measureText(this.pet.phaseLabel).width);
    const pill: Rect = { x: PANEL_RECT.x + 8, y: PANEL_RECT.y + 7, w: labelW + 18, h: 18 };
    const pillCy = pill.y + pill.h / 2;
    roundRect(ctx, pill, 9, this.accent());
    this.text(ctx, this.pet.phaseLabel, pill.x + pill.w / 2, pillCy + 0.5, 12, DARK_TEXT, { bold: true });

    this.text(ctx, this.statusLabel(), PANEL_RECT.x + PANEL_RECT.w - 8, pillCy, 11, MUTED, { align: "right" });

    this.drawPet(ctx, t, ...EXPANDED_PET);
    this.text(ctx, PomodoroPet.formatTime(this.pet.remaining), ...EXPANDED_TIMER, 26, this.timerColor(), {
      bold: true,
    });
    this.drawEnergy(ctx);
    this.drawCycles(ctx);
    this.button(ctx, BTN_MAIN, this.actionLabel(), true);
    this.button(ctx, BTN_SKIP, "pular");
    this.button(ctx, BTN_RESET, "reset");
    if (this.alert > 0) this.drawAlert(ctx, t, EXPANDED_PET[0], EXPANDED_PET[1] - 58);
  }

  private button(ctx: Ctx, rect: Rect, label: string, primary = false) {
    const hovered = this.mouse !== null && contains(rect, ...this.mouse);
    const active = primary && (this.pet.awaiting || !this.pet.running);
    const base = active ? this.accent() : shade(PANEL, 1.35);
    const color = mix(base, WHITE, hovered ? 0.25 : 0);
    roundRect(ctx, rect, 5, color, shade(PANEL, 1.9), 1);
    this.text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 0.5, 13, active ? DARK_TEXT : TEXT, {
      bold: true,
    });
  }

  private drawAlert(ctx: Ctx, t: number, x: number, y: number) {
    const pulse = 1 + 0.4 * Math.abs(Math.sin((t * 1000) / 130));
    this.text(ctx, "!", x, y, 13 * pulse, this.accent(), { bold: true });
  }

  private drawEnergy(ctx: Ctx) {
    const bar = ENERGY_BAR;
    roundRect(ctx, bar, 5, shade(PANEL, 0.8));
    const fillW = int(bar.w * clamp(this.pet.energy / 100, 0, 1));
    if (fillW > 0) roundRect(ctx, { ...bar, w: fillW }, 5, energyColor(this.pet.energy));
    roundRect(ctx, bar, 5, null, shade(PANEL, 1.8), 1);
    this.text(ctx, `energia ${int(this.pet.energy)}%`, bar.x, bar.y - 12, 11, MUTED, {
      align: "left",
      baseline: "top",
    });
  }

  private drawCycles(ctx: Ctx) {
    const x0 = ENERGY_BAR.x;
    this.text(ctx, "ciclos", x0, CYCLES_Y, 11, MUTED, { align: "left" });
    for (let i = 0; i < Math.min(this.pet.cycles, 6); i++) {
      fillCircle(ctx, BREAK_ACCENT, x0 + 52 + i * 14, CYCLES_Y, 4);
    }
    if (this.pet.cycles > 6) {
      this.text(ctx, `+${this.pet.cycles - 6}`, x0 + 52 + 6 * 14, CYCLES_Y, 11, MUTED, { align: "left" });
    }
  }

  private drawPet(ctx: Ctx, t: number, cx: number, cy: number) {
    const expr = this.expression();
    const resting = expr === "resting";

    let bob: number;
    if (this.joy > 0) {
      bob = -Math.abs(Math.sin(t * 7)) * 12 * Math.min(1, this.joy / 1.2);
    } else {
      const speed = resting ? 1.1 : 2.4;
      const amp = expr === "exhausted" ? 2 : 4;
      bob = Math.sin(t * speed) * amp;
    }

    // sombra no chao (so no painel; no modo flutuante fica estranha)
    if (this.expanded) {
      const shadowW = int(SPRITE * SCALE * 0.6);
      fillEllipse(ctx, [18, 19, 24], { x: cx - floorDiv(shadowW, 2), y: cy + 30, w: shadowW, h: 13 });
    }

    this.drawSprite(expr, t);
    const size = SPRITE * SCALE;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.sprite as CanvasImageSource,
      cx - floorDiv(size, 2),
      int(cy + bob) - floorDiv(size, 2),
      size,
      size,
    );
  }

  // --- sprite 64x64 ---
  /** Desenha o monstrengo na superficie do sprite (ampliada depois). */
  private drawSprite(expr: Expression, t: number) {
    const s = this.spriteCtx;
    s.clearRect(0, 0, SPRITE, SPRITE);
    const [bx, by, radius] = [32, 33, 17];
    let men = this.menace();
    if (this.joy > 0) men *= 0.6; // na comemoracao ele fica mais fofo que demonio
    const body = energyColor(this.pet.energy);
    const dark = shade(body, 0.52);
    const resting = expr === "resting";

    this.spriteTail(s, bx, by, radius, men, dark);
    this.spriteHorns(s, bx, by, radius, men, body);

    fillCircle(s, body, bx, by, radius);
    fillEllipse(s, mix(body, WHITE, 0.2), { x: bx - 9, y: by + 1, w: 18, h: 13 });
    if (men < 0.6) {
      fillEllipse(s, shade(body, 0.88), { x: bx - 14, y: by - 8, w: 7, h: 5 });
      fillEllipse(s, shade(body, 0.88), { x: bx + 6, y: by - 4, w: 5, h: 4 });
    }
    strokeCircle(s, INK, bx, by, radius, 2);

    for (const dx of [-6, 6]) {
      const foot = { x: bx + dx - 4, y: by + radius - 3, w: 8, h: 6 };
      fillEllipse(s, dark, foot);
      strokeEllipse(s, INK, foot);
    }

    this.spriteArms(s, bx, by, radius, body);

    if (expr === "happy" || expr === "ok" || resting) {
      for (const dx of [-11, 11]) fillCircle(s, [255, 140, 150], bx + dx, by + 4, 2);
    }

    this.spriteFace(s, bx, by, men, expr, t);

    if ((expr === "tired" || expr === "exhausted") && this.pet.running) this.spriteSweat(s, bx, by, t);
    if (resting) this.spriteZzz(s, bx, by, t);
    if (this.joy > 0) this.spriteJoy(s, bx, by, radius, t);

    snapAlpha(s, SPRITE);
  }

  private spriteTail(s: Ctx, bx: number, by: number, radius: number, men: number, color: Color) {
    if (men <= 0.2) return;
    const k = (men - 0.2) / 0.8;
    const start: Point = [bx + radius - 2, by + radius - 5];
    const mid: Point = [bx + radius + 6, by + radius - 7];
    const tip: Point = [bx + radius + 8, by + 2 - int(7 * k)];
    polyline(s, color, [start, mid, tip], 3);
    polygon(s, color, [
      [tip[0] - 3, tip[1] + 1],
      [tip[0] + 3, tip[1] + 1],
      [tip[0], tip[1] - 6],
    ]);
  }

  private spriteHorns(s: Ctx, bx: number, by: number, radius: number, men: number, body: Color) {
    const lit = mix(body, WHITE, 0.35);
    const color = mix(lit, [104, 62, 120], men);
    const length = int(lerp(5, 15, men));
    const curve = int(lerp(1, 5, men));
    const baseY = by - radius + 3;
    for (const side of [-1, 1]) {
      const baseX = bx + side * 9;
      const tip: Point = [int(bx + side * (9 + curve)), baseY - length];
      const points: Point[] = [[baseX - 3, baseY], [baseX + 3, baseY], tip];
      polygon(s, color, points);
      polygon(s, INK, points, 1);
    }
  }

  private spriteArms(s: Ctx, bx: number, by: number, radius: number, body: Color) {
    const arm = shade(body, 0.9);
    const raised = this.joy > 0;
    for (const side of [-1, 1]) {
      const rect = centered(7, 10, int(bx + side * (radius - 2)), int(by + (raised ? -2 : 4)));
      fillEllipse(s, arm, rect);
      strokeEllipse(s, INK, rect);
    }
  }

  private spriteFace(s: Ctx, bx: number, by: number, men: number, expr: Expression, t: number) {
    if (expr === "resting") {
      for (const side of [-1, 1]) {
        const [x, y] = [bx + side * 7, by - 4];
        polyline(s, INK, [[x - 4, y], [x, y + 2], [x + 4, y]], 2);
      }
      this.spriteMouth(s, bx, by + 8, 0, "smile");
      return;
    }
    if (expr === "exhausted") {
      for (const side of [-1, 1]) {
        const [x, y] = [bx + side * 7, by - 4];
        polyline(s, INK, [[x - 4, y + 1], [x, y - 2], [x + 4, y + 1]], 2);
      }
      this.spriteMouth(s, bx, by + 8, 1, "pant");
      return;
    }

    const blink = t % 3.6 < 0.11;
    const eyeW = int(lerp(8, 11, men));
    const eyeH = int(lerp(9, 5, men));
    const sclera = mix(EYE_WHITE, DEMON_EYE, men);
    for (const side of [-1, 1]) {
      const [x, y] = [bx + side * 7, by - 4];
      if (blink) {
        polyline(s, INK, [[x - floorDiv(eyeW, 2), y], [x + floorDiv(eyeW, 2), y]], 2);
        continue;
      }
      const rect = centered(eyeW, eyeH, x, y);
      fillEllipse(s, sclera, rect);
      strokeEllipse(s, INK, rect);
      const px = x + int(this.look[0] * 1.5);
      const py = expr === "focus" ? y + 1 : y + int(this.look[1] * 1.5);
      const pupilW = int(lerp(3, 2, men));
      const pupilH = int(lerp(4, eyeH - 1, men));
      fillEllipse(s, INK, centered(Math.max(2, pupilW), Math.max(3, pupilH), px, py));
      if (men < 0.7) fillRect(s, EYE_WHITE, x - 2, y - 2, 1, 1);

      const brow = Math.max(men, expr === "focus" ? 0.45 : 0);
      if (brow > 0.12) {
        const outer: Point = [x + side * floorDiv(eyeW, 2), y - floorDiv(eyeH, 2) - 1];
        const inner: Point = [x - side * floorDiv(eyeW, 2), y - floorDiv(eyeH, 2) - 1 + int(4 * brow)];
        polyline(s, INK, [outer, inner], 2);
      }
    }

    if (expr === "focus") this.spriteMouth(s, bx, by + 8, men, "flat");
    else if (expr === "tired") this.spriteMouth(s, bx, by + 8, men, "tired");
    else this.spriteMouth(s, bx, by + 8, men, "smile");
  }

  private spriteMouth(s: Ctx, mx: number, my: number, men: number, style: "smile" | "flat" | "tired" | "pant") {
    if (men >= 0.5 && style !== "pant") {
      const k = (men - 0.5) / 0.5;
      const gw = int(lerp(8, 20, k));
      const gh = int(lerp(3, 7, k));
      const top = my - floorDiv(gh, 2);
      const bottom = my + floorDiv(gh, 2);
      fillEllipse(s, INK, { x: mx - floorDiv(gw, 2), y: top, w: gw, h: gh });
      const teeth = 2 + int(3 * k);
      for (let i = 0; i < teeth; i++) {
        const fx = mx - floorDiv(gw, 2) + 2 + floorDiv(i * (gw - 4), Math.max(1, teeth - 1));
        polygon(s, TOOTH, [[fx - 1, top], [fx + 1, top], [fx, top + 3]]);
        polygon(s, TOOTH, [[fx - 1, bottom], [fx + 1, bottom], [fx, bottom - 3]]);
      }
      return;
    }
    if (style === "flat") {
      polyline(s, INK, [[mx - 5, my], [mx + 5, my]], 2);
    } else if (style === "tired") {
      polyline(s, INK, [[mx - 4, my], [mx + 4, my - 1]], 2);
    } else if (style === "pant") {
      fillEllipse(s, INK, { x: mx - 3, y: my - 2, w: 6, h: 6 });
    } else {
      polyline(s, INK, [[mx - 5, my], [mx, my + 3], [mx + 5, my]], 2);
      polygon(s, TOOTH, [[mx + 2, my - 1], [mx + 4, my - 1], [mx + 3, my + 2]]);
    }
  }

  private spriteSweat(s: Ctx, bx: number, by: number, t: number) {
    [-14, 14].forEach((dx, i) => {
      const phase = (t * 0.9 + i * 0.5) % 1;
      const x = bx + dx;
      const y = int(by - 8 + phase * 16);
      polygon(s, SWEAT, [[x, y - 3], [x - 2, y], [x + 2, y]]);
    });
  }

  private spriteZzz(s: Ctx, bx: number, by: number, t: number) {
    for (let i = 0; i < 3; i++) {
      const phase = (t * 0.6 + i / 3) % 1;
      const size = 4 + i;
      const x = bx + 12 + int(phase * 8) + i * 4;
      const y = by - 12 - int(phase * 18) - i * 8;
      polyline(s, [170 + i * 20, 210, 255], [[x, y], [x + size, y], [x, y + size], [x + size, y + size]], 2);
    }
  }

  private spriteJoy(s: Ctx, bx: number, by: number, radius: number, t: number) {
    strokeCircle(s, this.accent(), bx, by, radius + 4, 2);
    for (let i = 0; i < 6; i++) {
      const angle = t * 2.2 + (i * Math.PI) / 3;
      const rr = radius + 5 + 3 * Math.sin(t * 3 + i);
      const x = int(bx + Math.cos(angle) * rr);
      const y = int(by + Math.sin(angle) * rr * 0.8);
      fillRect(s, SPARK, x - 1, y - 3, 2, 6);
      fillRect(s, SPARK, x - 3, y - 1, 6, 2);
    }
  }
}
