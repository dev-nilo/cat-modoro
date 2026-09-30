# Pomodoro Pet

Timer Pomodoro em **Next.js + TypeScript** com um monstrengo fofo que **cansa enquanto você trabalha** e **se recupera nas pausas**. Quanto mais cansado, mais ele **vira um demoniozinho**: a cor, os chifres, os olhos e a boca vão mudando de fofos para demoníacos — um Tamagotchi de produtividade em pixel art.

A troca de fase é **manual**: ao terminar o foco, o monstrengo fica *aguardando* você marcar o início da pausa. É nesse momento que entra a animação de alegria — recompensa visual por respeitar o descanso.

---

## Rodando

```bash
npm install
npm run dev          # http://localhost:3000
```

- `http://localhost:3000/?demo` — ciclos curtos (6 s de foco / 4 s de pausa) para ver o fluxo completo em segundos.
- `npm run build && npm start` — build de produção (a página é estática).

Requisitos: Node 20+.

## Controles

| Ação | Entrada |
|------|---------|
| Revelar o painel | Passar o mouse sobre o monstrengo (no toque: tocar uma vez) |
| Botão de ação (iniciar / pausar / começar fase) | Botão principal, clique no monstrengo ou `Espaço` / `Enter` |
| Pular fase | Botão `pular` ou `S` |
| Novo ciclo (reset) | Botão `reset`, clique direito ou `R` |

O título da aba mostra o tempo restante e a fase, então dá para acompanhar o timer de outra aba.

---

## Como funciona

### Ciclo de fases

```
FOCO --(tempo acaba)--> aguardando --(usuário marca a pausa)--> PAUSA (comemora)
  ^                                                                  |
  +--------------- aguardando <--(tempo acaba)-----------------------+
```

| Fase | Duração padrão | Energia | Aparência |
|------|----------------|---------|-----------|
| FOCO | 25 min | cai | começa concentrado e vai ficando cansado |
| PAUSA | 5 min | sobe | cansado, dorme e acorda recuperado |

- `tick()` **nunca** troca de fase sozinho — só sinaliza o fim com um evento (`focus_done` / `break_done`).
- `awaiting = true` → o tempo acabou; `running` vira `false` e `remaining` vai a `0`.
- `advance()` / `toggle()` a partir de `awaiting` inicia a próxima fase (`break_started` / `focus_started`).

### Modelo de energia

```
Durante FOCO:   E = clamp(E - focusCost    / focusDuration * dt, 0, 100)
Durante PAUSA:  E = clamp(E + breakRestore / breakDuration * dt, 0, 100)
```

Com os padrões (`focusCost = 45`, `breakRestore = 45`): `E=85 --FOCO--> 40 --PAUSA--> 85`. Com `breakRestore < focusCost` o cansaço acumula ao longo do dia.

### Humor

| Condição | Humor |
|----------|-------|
| energia ≤ 20 | `exhausted` |
| energia ≤ 45 | `tired` |
| foco e energia > 45 | `focus` |
| pausa e energia ≤ 75 | `ok` |
| pausa e energia > 75 | `happy` |

A camada visual acrescenta `resting` (pausa com energia < 70: olhos fechados e `zZz`) e prioriza a animação de alegria. A "demonização" é contínua via `menace()` (0 = fofo, 1 = demônio), que interpola cor, chifres, olhos, boca e cauda.

---

## Arquitetura

| Arquivo | Responsabilidade |
|---------|------------------|
| [src/lib/pet.ts](src/lib/pet.ts) | Lógica pura (`PomodoroPet`): máquina de estados, energia, humor, `formatTime`. Sem DOM. |
| [src/lib/view.ts](src/lib/view.ts) | `PetView`: expressões, animações, layout, cliques e todo o desenho em Canvas 2D. Não conhece React. |
| [src/components/PomodoroPet.tsx](src/components/PomodoroPet.tsx) | Client component: loop `requestAnimationFrame`, mouse/toque/teclado, escala para HiDPI. |
| [src/app/](src/app/) | App Router: layout e página. |
| [tests/](tests/) | Vitest: lógica (`pet.test.ts`) e desenho com contexto 2D falso (`view.test.ts`). |

### Pixel art em canvas

O monstrengo é desenhado numa superfície `64×64` e ampliado `2×` com `imageSmoothingEnabled = false`. Depois de desenhar, o canal alfa do sprite é "binarizado" (cada pixel fica opaco ou transparente) para manter o traço serrilhado. O canvas principal trabalha num espaço lógico de `240×168`, escalado por `devicePixelRatio` para o texto ficar nítido.

### Comportamento no navegador

- **Opacidade**: o canvas fica com opacidade baixa em repouso e sobe no hover (`ALPHA_IDLE` / `ALPHA_ACTIVE`).
- **Aba em segundo plano**: o `requestAnimationFrame` para, e ao voltar o `dt` grande "alcança" o tempo perdido — `tick()` já trata o excesso corretamente.

---

## Testes

```bash
npm test           # vitest run
npm run typecheck  # tsc --noEmit
```

Os testes cobrem a lógica de energia e do Pomodoro, o desenho do monstrengo e os cliques no painel.

## Parâmetros de ajuste

| Parâmetro | Local | Padrão |
|-----------|-------|--------|
| `focusDuration` / `breakDuration` | `PomodoroPet` | `25*60` / `5*60` |
| `startEnergy` / `focusCost` / `breakRestore` | `PomodoroPet` | `85` / `45` / `45` |
| `EXHAUSTED_MAX` / `TIRED_MAX` / `OK_MAX` | `pet.ts` | `20` / `45` / `75` |
| `SPRITE` / `SCALE` | `view.ts` | `64` / `2` |
| `ALPHA_IDLE` / `ALPHA_ACTIVE` | `view.ts` | `120` / `240` |
| `REVEAL_SPEED` / `REVEAL_THRESHOLD` | `view.ts` | `6.0` / `0.4` |
| `JOY_TIME` / `ALERT_TIME` | `view.ts` | `1.8` / `1.6` |
| `CSS_SCALE` | `PomodoroPet.tsx` | `2` |

## Possíveis extensões

- Janela flutuante sempre no topo com a [Document Picture-in-Picture API](https://developer.chrome.com/docs/web-platform/document-picture-in-picture) (Chrome/Edge).
- Notificação e som ao fim de fase.
- Persistência de energia/ciclos em `localStorage`.
- Ciclos longos de descanso (a cada 4 focos).
