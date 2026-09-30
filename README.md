# Pomodoro Cat

A Pomodoro timer with a pixel-art cat that **gets tired while you work** and **recharges when you take breaks**. Adopt your own cat, pick its coat, eyes and accessory, and look after each other.

Built with Next.js, React and TypeScript. No sprite images: every frame of the cat is drawn from palette-indexed pixel grids in code.

---

## Features

- **Your cat, your way.** On the first visit you adopt a cat: 6 coats (orange tabby, black, white, gray tabby, tuxedo, calico), 4 eye colors (including odd eyes), 5 accessories and a name. You can change any of it later in Settings.
- **A cat that reacts to your day.** It focuses in a loaf while you work, gets sleepy, then grumpy as energy drains, and naps on your breaks. If you push it all the way to empty, it turns into something else.
- **Manual phase changes.** When a session ends, the cat waits for you. Starting a break is a conscious click, and the cat thanks you with a big stretch.
- **Pomodoro essentials.** Configurable focus / short break / long break lengths, and a long break every N sessions.
- **Floating mode.** "Pop out" opens an always-on-top mini window through Document Picture-in-Picture, so the cat can sit on top of your work (Chrome and Edge).
- **It remembers.** Everything is saved in `localStorage`. The timer keeps running while the tab is closed, and each day starts fresh at midnight.
- **Heads-up.** An 8-bit meow plays when a session ends. Browser notifications are opt-in.
- **Accessible and calm.** Keyboard shortcuts, real HTML controls, light and dark themes that follow the system, and `prefers-reduced-motion` support.

## Getting started

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # Vitest
npm run build     # static production build (deploys as-is to Vercel or any static host)
```

Requires Node 20+.

## Controls

| Action | Input |
|---|---|
| Start / pause / begin the next session | Main button, `Space` or `Enter` |
| Skip the current session | Skip button or `S` |
| Reset today's progress | Reset button or `R` (asks for confirmation) |
| Pet the cat | Click the cat or press `P` |
| Shortcut help | `?` |

---

## How it works

### Session cycle

```
FOCUS --time's up--> waiting --you start the break--> BREAK (stretch!)
  ^                                                      |
  +------------- waiting <--------time's up--------------+
```

Every `longBreakEvery` completed focus sessions, the break is a long one.

| Setting | Default | Range |
|---|---|---|
| Focus | 25 min | 1–90 |
| Short break | 5 min | 1–30 |
| Long break | 15 min | 5–60 |
| Long break every | 4 sessions | 2–8 |

### Energy

Energy runs from 0 to 100. It is defined per full session, so changing the durations never unbalances it:

- a full **focus** session costs 45,
- a full **short break** gives 45 back,
- a full **long break** always brings the cat back to 100.

The cat starts the day at 85.

### Cat states

| State | When |
|---|---|
| `idle` | Not started or paused, with energy > 45 |
| `focus` | Focus running, energy > 45 |
| `tired` | Energy ≤ 45 |
| `grumpy` | Energy ≤ 20 |
| `possessed` | Energy ≤ 5 (easter egg) |
| `awaiting` | A session ended and the cat is waiting for you |
| `stretch` | Right after you start a break |
| `sleeping` | On a break with energy < 70 |
| `happy` | On a break with energy ≥ 70, or while being petted |

---

## Architecture

```
src/
├── app/                 layout, page, global styles (design tokens, light/dark)
├── components/          React UI: Home, Adoption, Settings, PiP view, CatCanvas…
├── hooks/
│   ├── usePomodoro.ts   engine + persistence + reactions + sound/notifications
│   └── useShortcuts.ts  keyboard shortcuts across the main and PiP windows
└── lib/
    ├── timer.ts         pure Pomodoro engine (phases, energy, settings)
    ├── storage.ts       versioned localStorage save, catch-up and day rollover
    ├── browser.ts       WebAudio chiptunes, notifications, Document PiP
    └── cat/
        ├── config.ts    customization options and validation
        ├── sprites.ts   pixel grids and layer composition
        ├── palette.ts   colors per coat / eyes / accessory
        ├── state.ts     timer → cat state → animation frame
        └── render.ts    frame → RGBA pixels (cat, cushion, effects)
tests/                   Vitest: engine, persistence, sprites and rendering
```

### Pixel art without images

Each part of the cat (head, ears, eyes, mouth, body poses, tails, accessories) is a small grid of palette keys:

```ts
// left half of the head; sym() mirrors it into the full 20px-wide row
"....oooooo",
"..ooffffff",
".offfffpfp",   // o = outline, f = fur, p = tabby stripes
```

A frame is a stack of layers rasterized onto a 32×32 grid, then mapped to colors. So a new coat is just a new palette, and calico patches are blobs that recolor fur pixels. `render.ts` writes the result into a 48×44 RGBA buffer together with the cushion, hearts, `zZ` and the "!" bubble. The canvas shows it at native size, and CSS scales it up with `image-rendering: pixelated`.

Rendering is pure (state + time → pixels), so it is tested without a browser.

### Time and persistence

The engine never trusts `setInterval` to be regular: every tick advances by elapsed wall-clock time, so throttled background tabs stay accurate. On load, the saved timer is fast-forwarded by the time the app was closed, and any session that ended while you were away is waiting for you. Cycles and energy reset at local midnight, but a session that is running when the day changes is allowed to finish first.

### Floating window

`documentPictureInPicture.requestWindow()` opens a tiny always-on-top window. The page's stylesheets are copied into it and a React portal renders the mini view there. The cat's animation loop and an extra clock run on that window's own timers, so they stay smooth while the main tab is in the background. The button only appears in browsers that support the API.

---

## Out of scope for now

- History and statistics (streaks, sessions per day)
- Customizable scenery
- More coats (Siamese, …) and accessories: adding one is a palette entry plus, for new shapes, a grid
- Sync across devices
