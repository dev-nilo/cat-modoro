import { beforeEach, describe, expect, it } from "vitest";

import { BREAK, BREAK_DONE, BREAK_STARTED, FOCUS, FOCUS_DONE, FOCUS_STARTED, PomodoroPet } from "@/lib/pet";

let pet: PomodoroPet;

beforeEach(() => {
  pet = new PomodoroPet({ focusDuration: 100, breakDuration: 40, startEnergy: 85, focusCost: 40, breakRestore: 40 });
});

describe("formatTime", () => {
  it.each([
    [0, "00:00"],
    [45, "00:45"],
    [120, "02:00"],
    [90, "01:30"],
    [25 * 60, "25:00"],
    [-5, "00:00"],
    [59.9, "00:59"],
  ])("%s -> %s", (seconds, expected) => {
    expect(PomodoroPet.formatTime(seconds)).toBe(expected);
  });
});

describe("estado inicial", () => {
  it("usa os padroes", () => {
    const p = new PomodoroPet();
    expect(p.phase).toBe(FOCUS);
    expect(p.remaining).toBe(25 * 60);
    expect(p.running).toBe(false);
    expect(p.awaiting).toBe(false);
    expect(p.cycles).toBe(0);
    expect(p.energy).toBe(85);
  });

  it("comeca com cara de foco", () => {
    expect(pet.mood).toBe("focus");
  });

  it("nextPhase", () => {
    expect(pet.nextPhase).toBe(BREAK);
    pet.skip();
    pet.advance();
    expect(pet.nextPhase).toBe(FOCUS);
  });

  it("phaseLabel", () => {
    expect(pet.phaseLabel).toBe("FOCO");
    pet.skip();
    pet.advance();
    expect(pet.phaseLabel).toBe("PAUSA");
  });
});

describe("controles", () => {
  it("toggle alterna rodando/pausado", () => {
    expect(pet.toggle()).toBeNull();
    expect(pet.running).toBe(true);
    expect(pet.toggle()).toBeNull();
    expect(pet.running).toBe(false);
  });

  it("toggle avanca quando aguardando", () => {
    pet.skip(); // foco encerrado -> aguardando
    expect(pet.awaiting).toBe(true);
    expect(pet.toggle()).toBe(BREAK_STARTED);
    expect(pet.phase).toBe(BREAK);
    expect(pet.running).toBe(true);
    expect(pet.awaiting).toBe(false);
  });

  it("advance sem aguardar nao faz nada", () => {
    expect(pet.advance()).toBeNull();
    expect(pet.phase).toBe(FOCUS);
  });

  it("advance da pausa para o foco", () => {
    pet.skip();
    pet.advance(); // FOCO -> PAUSA
    pet.skip(); // pausa encerrada -> aguardando
    expect(pet.toggle()).toBe(FOCUS_STARTED);
    expect(pet.phase).toBe(FOCUS);
  });

  it("reset restaura tudo", () => {
    pet.start();
    pet.remaining = 3;
    pet.energy = 10;
    pet.cycles = 4;
    pet.awaiting = true;
    pet.reset();
    expect(pet.remaining).toBe(100);
    expect(pet.energy).toBe(85);
    expect(pet.cycles).toBe(0);
    expect(pet.phase).toBe(FOCUS);
    expect(pet.running).toBe(false);
    expect(pet.awaiting).toBe(false);
  });

  it("skip encerra o foco", () => {
    expect(pet.skip()).toBe(FOCUS_DONE);
    expect(pet.awaiting).toBe(true);
    expect(pet.running).toBe(false);
    expect(pet.remaining).toBe(0);
    expect(pet.cycles).toBe(1);
  });

  it("skip encerra a pausa", () => {
    pet.skip();
    pet.advance();
    expect(pet.skip()).toBe(BREAK_DONE);
    expect(pet.awaiting).toBe(true);
  });
});

describe("tick", () => {
  it("pausado nao faz nada", () => {
    pet.energy = 50;
    expect(pet.tick(10)).toEqual([]);
    expect(pet.energy).toBe(50);
    expect(pet.remaining).toBe(100);
  });

  it("foco drena energia", () => {
    pet.start();
    expect(pet.tick(50)).toEqual([]);
    expect(pet.energy).toBe(65); // 85 - 40 * (50/100)
    expect(pet.remaining).toBe(50);
    expect(pet.phase).toBe(FOCUS);
  });

  it("fim do foco aguarda, nao avanca sozinho", () => {
    pet.start();
    pet.tick(50);
    expect(pet.tick(50)).toEqual([FOCUS_DONE]);
    expect(pet.phase).toBe(FOCUS); // ainda no foco, esperando o usuario
    expect(pet.awaiting).toBe(true);
    expect(pet.running).toBe(false);
    expect(pet.energy).toBe(45);
    expect(pet.cycles).toBe(1);
  });

  it("pausa restaura energia", () => {
    pet.start();
    pet.tick(100); // encerra o foco
    pet.advance(); // usuario marca a pausa
    pet.tick(40);
    expect(pet.energy).toBe(85); // 45 + 40
    expect(pet.phase).toBe(BREAK);
  });

  it("fim da pausa aguarda", () => {
    pet.start();
    pet.tick(100);
    pet.advance();
    expect(pet.tick(40)).toEqual([BREAK_DONE]);
    expect(pet.awaiting).toBe(true);
    expect(pet.cycles).toBe(1);
  });

  it("energia e limitada a 100", () => {
    pet.energy = 95;
    pet.start();
    pet.skip();
    pet.advance();
    pet.tick(40);
    expect(pet.energy).toBe(100);
  });

  it("excesso de dt so drena o tempo restante", () => {
    pet.remaining = 10;
    pet.start();
    pet.tick(1000); // so 10s contam para a energia
    expect(pet.energy).toBeCloseTo(85 - 40 * 0.1);
    expect(pet.awaiting).toBe(true);
  });

  it("tick aguardando nao faz nada", () => {
    pet.skip();
    expect(pet.tick(50)).toEqual([]);
    expect(pet.remaining).toBe(0);
  });
});

describe("consultas", () => {
  it("progress", () => {
    pet.remaining = 25;
    expect(pet.progress).toBeCloseTo(0.75);
  });

  it("progress cheio quando aguardando", () => {
    pet.skip();
    expect(pet.progress).toBe(1);
  });

  it("duration segue a fase", () => {
    expect(pet.duration).toBe(100);
    pet.skip();
    pet.advance();
    expect(pet.duration).toBe(40);
  });

  it.each([
    [0, "exhausted"],
    [20, "exhausted"],
    [21, "tired"],
    [45, "tired"],
  ])("energia %s -> %s em qualquer fase", (energy, mood) => {
    pet.energy = energy;
    expect(pet.mood).toBe(mood);
    pet.skip();
    pet.advance();
    expect(pet.mood).toBe(mood);
  });

  it("humor de foco enquanto trabalha", () => {
    pet.energy = 90;
    expect(pet.mood).toBe("focus");
    pet.energy = 60;
    expect(pet.mood).toBe("focus");
  });

  it("humor se recupera na pausa", () => {
    pet.skip();
    pet.advance();
    pet.energy = 60;
    expect(pet.mood).toBe("ok");
    pet.energy = 90;
    expect(pet.mood).toBe("happy");
  });

  it("resting so durante a pausa rodando", () => {
    pet.skip();
    pet.advance();
    expect(pet.phase).toBe(BREAK);
    expect(pet.resting).toBe(true);
    pet.pause();
    expect(pet.resting).toBe(false);
  });
});
