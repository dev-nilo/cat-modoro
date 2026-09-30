/**
 * Logica pura do Pomodoro-Tamagotchi: ciclo foco/pausa e energia/humor.
 *
 * Este modulo nao depende de DOM nem de canvas de proposito, para poder ser
 * testado sem navegador. A renderizacao fica em view.ts.
 *
 * Fluxo:
 *     FOCO (rodando) --acaba--> FOCO (aguardando o usuario marcar a pausa)
 *         --advance()--> PAUSA (rodando, comemorando) --acaba-->
 *     PAUSA (aguardando) --advance()--> FOCO ...
 */

export const FOCUS = "focus";
export const BREAK = "break";
export type Phase = typeof FOCUS | typeof BREAK;

export const PHASE_LABELS: Record<Phase, string> = { focus: "FOCO", break: "PAUSA" };

// Limiares de humor (energia 0..100)
export const EXHAUSTED_MAX = 20;
export const TIRED_MAX = 45;
export const OK_MAX = 75;

// Eventos devolvidos por tick()/skip()/toggle()/advance()
export const FOCUS_DONE = "focus_done";
export const BREAK_DONE = "break_done";
export const BREAK_STARTED = "break_started";
export const FOCUS_STARTED = "focus_started";
export type PetEvent =
  | typeof FOCUS_DONE
  | typeof BREAK_DONE
  | typeof BREAK_STARTED
  | typeof FOCUS_STARTED;

export type Mood = "focus" | "happy" | "ok" | "tired" | "exhausted";

export interface PetOptions {
  focusDuration?: number; // segundos de foco
  breakDuration?: number; // segundos de pausa
  startEnergy?: number; // energia inicial
  focusCost?: number; // energia perdida por fase de foco completa
  breakRestore?: number; // energia recuperada por pausa completa
}

/**
 * Maquina de estados do ciclo Pomodoro + bichinho que cansa e descansa.
 *
 * A energia cai durante o foco e sobe durante a pausa. Os custos sao dados em
 * pontos por fase completa, entao a dinamica independe da duracao escolhida.
 *
 * A troca de fase e manual: quando o tempo acaba o bichinho fica *aguardando*
 * (awaiting) ate o usuario chamar advance() — o que da o gancho para a
 * animacao de alegria ao comecar a pausa.
 */
export class PomodoroPet {
  readonly focusDuration: number;
  readonly breakDuration: number;
  readonly startEnergy: number;
  readonly focusCost: number;
  readonly breakRestore: number;

  phase: Phase = FOCUS;
  remaining: number;
  running = false;
  awaiting = false;
  cycles = 0;
  energy: number;

  constructor({
    focusDuration = 25 * 60,
    breakDuration = 5 * 60,
    startEnergy = 85,
    focusCost = 45,
    breakRestore = 45,
  }: PetOptions = {}) {
    this.focusDuration = focusDuration;
    this.breakDuration = breakDuration;
    this.startEnergy = startEnergy;
    this.focusCost = focusCost;
    this.breakRestore = breakRestore;

    this.remaining = this.focusDuration;
    this.energy = this.startEnergy;
  }

  // --- controles ---
  start(): void {
    if (!this.awaiting) this.running = true;
  }

  pause(): void {
    this.running = false;
  }

  /** Iniciar/pausar; se estiver aguardando, inicia a proxima fase. */
  toggle(): PetEvent | null {
    if (this.awaiting) return this.advance();
    this.running = !this.running;
    return null;
  }

  /** Comeca a proxima fase a partir do estado 'aguardando'. */
  advance(): PetEvent | null {
    if (!this.awaiting) return null;
    this.awaiting = false;
    this.running = true;
    if (this.phase === FOCUS) {
      this.phase = BREAK;
      this.remaining = this.breakDuration;
      return BREAK_STARTED;
    }
    this.phase = FOCUS;
    this.remaining = this.focusDuration;
    return FOCUS_STARTED;
  }

  /** Nova sessao completa: volta para o foco com a energia inicial. */
  reset(): void {
    this.phase = FOCUS;
    this.remaining = this.focusDuration;
    this.running = false;
    this.awaiting = false;
    this.cycles = 0;
    this.energy = this.startEnergy;
  }

  /** Encerra a fase atual agora, deixando o bichinho aguardando. */
  skip(): PetEvent {
    return this.finishPhase();
  }

  // --- simulacao ---
  /** Avanca `dt` segundos. Retorna a lista de eventos ocorridos. */
  tick(dt: number): PetEvent[] {
    if (!this.running || this.awaiting || dt <= 0) return [];

    const step = Math.min(dt, this.remaining);
    this.applyEnergy(step);
    if (this.remaining > dt) {
      this.remaining -= dt;
      return [];
    }
    return [this.finishPhase()];
  }

  private applyEnergy(seconds: number): void {
    if (this.phase === FOCUS) {
      const rate = this.focusDuration ? this.focusCost / this.focusDuration : 0;
      this.energy -= rate * seconds;
    } else {
      const rate = this.breakDuration ? this.breakRestore / this.breakDuration : 0;
      this.energy += rate * seconds;
    }
    this.energy = Math.max(0, Math.min(100, this.energy));
  }

  private finishPhase(): PetEvent {
    this.running = false;
    this.awaiting = true;
    this.remaining = 0;
    if (this.phase === FOCUS) {
      this.cycles += 1;
      return FOCUS_DONE;
    }
    return BREAK_DONE;
  }

  // --- consultas ---
  get duration(): number {
    return this.phase === FOCUS ? this.focusDuration : this.breakDuration;
  }

  get nextPhase(): Phase {
    return this.phase === FOCUS ? BREAK : FOCUS;
  }

  /** Fracao ja decorrida da fase atual (0..1). */
  get progress(): number {
    if (this.duration <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - this.remaining / this.duration));
  }

  get mood(): Mood {
    const energy = this.energy;
    if (energy <= EXHAUSTED_MAX) return "exhausted";
    if (energy <= TIRED_MAX) return "tired";
    if (this.phase === FOCUS) return "focus";
    if (energy <= OK_MAX) return "ok";
    return "happy";
  }

  get resting(): boolean {
    return this.phase === BREAK && this.running;
  }

  get phaseLabel(): string {
    return PHASE_LABELS[this.phase];
  }

  static formatTime(seconds: number): string {
    const total = Math.max(0, Math.trunc(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
}
