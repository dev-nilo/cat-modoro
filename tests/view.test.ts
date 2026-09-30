/** Smoke tests da camada de desenho com um contexto 2D falso (sem navegador). */

import { beforeEach, describe, expect, it } from "vitest";

import { BREAK, FOCUS } from "@/lib/pet";
import {
  BTN_MAIN,
  BTN_RESET,
  BTN_SKIP,
  JOY_TIME,
  PetView,
  clamp,
  energyColor,
  mix,
  shade,
  type SpriteCanvas,
} from "@/lib/view";

/** Contexto 2D que aceita qualquer chamada e registra quantas foram feitas. */
function fakeContext() {
  const state: Record<string | symbol, unknown> = { calls: 0 };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "measureText") return () => ({ width: 30 });
      if (prop === "getImageData") {
        return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
      }
      return () => {
        (target.calls as number)++;
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D & { calls: number };
}

const fakeCanvas = (w: number, h: number): SpriteCanvas => {
  const ctx = fakeContext();
  return { width: w, height: h, getContext: () => ctx };
};

const center = (r: { x: number; y: number; w: number; h: number }): [number, number] => [
  r.x + r.w / 2,
  r.y + r.h / 2,
];

let view: PetView;

beforeEach(() => {
  view = new PetView({ focusDuration: 2, breakDuration: 1, createCanvas: fakeCanvas });
});

describe("helpers", () => {
  it("clamp", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it("mix", () => {
    expect(mix([0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15]);
  });

  it("shade", () => {
    expect(shade([100, 100, 100], 0.5)).toEqual([50, 50, 50]);
  });

  it("energyColor e mais verde com energia cheia", () => {
    expect(energyColor(100)[1]).toBeGreaterThan(energyColor(0)[1]);
  });
});

describe("expressao", () => {
  it("comeca focado", () => {
    expect(view.expression()).toBe("focus");
  });

  it("cansado e exausto", () => {
    view.pet.energy = 30;
    expect(view.expression()).toBe("tired");
    view.pet.energy = 10;
    expect(view.expression()).toBe("exhausted");
  });

  it("descansando na pausa", () => {
    view.pet.skip();
    view.pet.advance();
    view.pet.energy = 50;
    expect(view.expression()).toBe("resting");
  });

  it("acorda recuperado", () => {
    view.pet.skip();
    view.pet.advance();
    view.pet.energy = 80;
    expect(view.expression()).toBe("happy");
  });

  it("menace cresce conforme a energia cai", () => {
    view.pet.energy = 100;
    expect(view.menace()).toBe(0);
    view.pet.energy = 0;
    expect(view.menace()).toBe(1);
  });
});

describe("rotulo do botao", () => {
  it("iniciar foco", () => {
    expect(view.actionLabel()).toBe("iniciar foco");
  });

  it("pausar", () => {
    view.pet.start();
    expect(view.actionLabel()).toBe("pausar");
  });

  it("retomar", () => {
    view.pet.start();
    view.pet.tick(0.5);
    view.pet.pause();
    expect(view.actionLabel()).toBe("retomar");
  });

  it("começar pausa", () => {
    view.pet.skip();
    expect(view.actionLabel()).toBe("começar pausa");
  });
});

describe("animacao de alegria", () => {
  it("pausa comeca com alegria", () => {
    view.pet.skip(); // foco encerrado, aguardando
    view.primaryAction(); // marca o inicio da pausa
    expect(view.pet.phase).toBe(BREAK);
    expect(view.pet.running).toBe(true);
    expect(view.joy).toBeGreaterThan(0);
  });

  it("sem alegria ao iniciar o foco", () => {
    view.primaryAction();
    expect(view.pet.running).toBe(true);
    expect(view.joy).toBe(0);
  });

  it("alegria decai", () => {
    view.pet.skip();
    view.primaryAction();
    view.update(0.5);
    expect(view.joy).toBeGreaterThan(0);
    expect(view.joy).toBeLessThan(JOY_TIME);
  });
});

describe("render", () => {
  it("desenha todos os humores", () => {
    const ctx = fakeContext();
    for (const energy of [0, 15, 30, 50, 70, 90, 100]) {
      view.pet.energy = energy;
      view.draw(ctx, energy / 10);
    }
    expect(ctx.calls).toBeGreaterThan(0);
  });

  it("desenha na pausa", () => {
    view.pet.skip();
    view.pet.advance();
    for (const energy of [60, 90]) {
      view.pet.energy = energy;
      view.draw(fakeContext(), 1);
    }
  });

  it("desenha aguardando com alerta", () => {
    view.pet.skip();
    view.alert = 1.6;
    view.draw(fakeContext(), 1);
  });

  it("desenha com alegria", () => {
    view.pet.skip();
    view.primaryAction();
    view.draw(fakeContext(), 1);
  });

  it("desenha o layout expandido", () => {
    view.reveal = 1;
    view.mouse = center(BTN_MAIN);
    view.pet.start();
    view.pet.cycles = 9;
    view.pet.energy = 60;
    view.draw(fakeContext(), 1);
    view.pet.skip();
    view.alert = 1.6;
    view.draw(fakeContext(), 1);
  });

  it("update aguarda apos o foco", () => {
    view.pet.start();
    for (let i = 0; i < 130; i++) view.update(1 / 60); // 2s de foco + folga
    expect(view.pet.awaiting).toBe(true);
    expect(view.pet.phase).toBe(FOCUS); // nao troca sozinho
    expect(view.alert).toBeGreaterThan(0);
  });
});

describe("overlay", () => {
  it("limiar de expansao", () => {
    view.reveal = 0;
    expect(view.expanded).toBe(false);
    view.reveal = 1;
    expect(view.expanded).toBe(true);
  });

  it("reveal segue o hover e fica em 0..1", () => {
    view.hovering = true;
    for (let i = 0; i < 200; i++) view.update(1 / 60);
    expect(view.reveal).toBe(1);
    view.hovering = false;
    for (let i = 0; i < 200; i++) view.update(1 / 60);
    expect(view.reveal).toBe(0);
  });

  it("opacidade sobe com o hover", () => {
    view.reveal = 0;
    const idle = view.opacity;
    view.reveal = 1;
    expect(view.opacity).toBeGreaterThan(idle);
  });

  it("petRect segue o layout", () => {
    view.reveal = 0;
    const compact = view.petRect();
    view.reveal = 1;
    expect(view.petRect()).not.toEqual(compact);
  });
});

describe("cliques", () => {
  it("no modo compacto qualquer clique e a acao principal", () => {
    view.click(1, 1);
    expect(view.pet.running).toBe(true);
  });

  it("botoes do painel expandido", () => {
    view.reveal = 1;
    view.click(...center(BTN_MAIN));
    expect(view.pet.running).toBe(true);

    view.click(...center(BTN_SKIP));
    expect(view.pet.awaiting).toBe(true);
    expect(view.alert).toBeGreaterThan(0);

    view.click(...center(BTN_RESET));
    expect(view.pet.awaiting).toBe(false);
    expect(view.pet.cycles).toBe(0);
  });

  it("clicar no monstrengo expandido tambem aciona", () => {
    view.reveal = 1;
    view.click(...center(view.petRect()));
    expect(view.pet.running).toBe(true);
  });
});
