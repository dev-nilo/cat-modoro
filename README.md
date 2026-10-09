# Cat-modoro

A Pomodoro timer with a pixel-art cat that **gets tired while you work** and **recharges when you take breaks**. Adopt your own cat, pick its coat, eyes and accessory, and look after each other.

Built with Next.js, React and TypeScript. No sprite images: every frame of the cat is drawn from palette-indexed pixel grids in code.

---

## Features

- **Your cat, your way.** On the first visit you adopt a cat: 7 coats (orange tabby, black, white, gray tabby, tuxedo, calico, snowshoe), 4 eye colors (including odd eyes), 5 accessories and a name. You can change any of it later in Settings.
- **A cat that reacts to your day.** It focuses in a loaf while you work, gets sleepy, then grumpy as energy drains, and naps on your breaks. If you push it all the way to empty, it turns into something else.
- **Manual phase changes.** When a session ends, the cat waits for you. Starting a break is a conscious click, and the cat thanks you with a big stretch.
- **Pomodoro essentials.** Configurable focus / short break / long break lengths, and a long break every N sessions.
- **Floating mode.** "Pop out" opens an always-on-top mini window through Document Picture-in-Picture, so the cat can sit on top of your work (Chrome and Edge).
- **It remembers.** Everything is saved in `localStorage`. The timer keeps running while the tab is closed, and each day starts fresh at midnight.
- **History.** Every finished (or skipped) phase is sent to a small REST API in the background, so past days live on in Settings → History, even offline-first.
- **Heads-up.** An 8-bit meow plays when a session ends. Browser notifications are opt-in.
- **Accessible and calm.** Keyboard shortcuts, real HTML controls, light and dark themes that follow the system, and `prefers-reduced-motion` support.

## Getting started

```bash
npm install
vercel link && vercel env pull   # DATABASE_URL & co. from the Neon integration
npm run db:migrate               # apply drizzle/ migrations (direct connection)
npm run dev                      # http://localhost:3000 · API docs at /docs
npm test                         # Vitest (the API tests use an in-memory Postgres, no setup needed)
npm run build
```

Requires Node 20+. Without a database the timer still works; only the History tab can't load.

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

## API

`/api/v1/sessions` keeps the history of finished phases in Postgres. Interactive docs: [`/docs`](https://cat-modoro.vercel.app/docs) · contract: [`/api/v1/openapi.json`](https://cat-modoro.vercel.app/api/v1/openapi.json).

| Method | Path | Success | Errors |
|---|---|---|---|
| `POST` | `/api/v1/sessions` | `201` + `Location` (`200` for an identical retry) | `400`, `404`, `409` |
| `GET` | `/api/v1/sessions?page=0&size=20&from&to` | `200`, newest first | `400` |
| `GET` | `/api/v1/sessions/{id}` | `200` | `404` |
| `DELETE` | `/api/v1/sessions/{id}` | `204` | `404` |

```http
POST /api/v1/sessions
X-Client-Id: 3f1c…
Content-Type: application/json

{ "id": "c8b2…", "kind": "focus", "outcome": "completed",
  "startedAt": "2026-10-09T13:00:00Z", "endedAt": "2026-10-09T13:25:00Z", "plannedSeconds": 1500 }

HTTP/1.1 201 Created
Location: /api/v1/sessions/c8b2…
```

### Six REST decisions, and where they live

| Avoid | Prefer | Here |
|---|---|---|
| `/getSession?id=42` | `GET /sessions/42` | Resource URLs and HTTP verbs only: [`app/api/v1/sessions`](src/app/api/v1/sessions) |
| `200` with `"error"` in the body | `404` + Problem Details | RFC 9457 `application/problem+json` with a fixed catalog of types ([`problem.ts`](src/server/http/problem.ts)). Validation errors list every bad field. |
| `GET /sessions` with no limit | `?page=0&size=20` | Spring-style envelope `{ content, page: { number, size, totalElements, totalPages } }`; `size` is capped at 100 |
| `POST` that only returns `200` | `201` + `Location` | Plus idempotency: the client generates the id, so a retry returns `200` with the stored copy and a reused id with different data is a `409` |
| Unversioned URL | `/v1/...` | `/api/v1/` |
| Contract only in the code | OpenAPI | The Zod schemas that validate requests also generate the OpenAPI 3.1 document ([`openapi.ts`](src/server/openapi.ts)), and a test fails if a route isn't documented |

### Identity and privacy

There are no accounts. Each browser generates an anonymous UUID and sends it as `X-Client-Id`; every query is scoped to it, and another client's session answers `404` (not `403`), so ids can't be probed. The flip side: **anyone who has that UUID can read and delete that history**. That's an acceptable trade-off for Pomodoro timestamps, not for anything sensitive. Rate limiting is left to the Vercel Firewall.

### Local-first sync

The timer never waits on the network. When a phase ends, `lib/history.ts` puts a record in an outbox in `localStorage` and POSTs it in the background (again on load and when the browser comes back `online`). A network error, `429` or `5xx` keeps it queued; a `4xx` that will never succeed drops it. Because the id is generated on the client, re-sending after a lost response can't create duplicates.

### Tests

`tests/api.test.ts` calls the real route handlers with `Request` objects against [PGlite](https://pglite.dev) (Postgres compiled to WASM) after applying the real migrations, so SQL, constraints and `ON CONFLICT` behave as in production, with no Docker.

---

## Architecture

```
src/
├── app/                 layout, page, global styles (design tokens, light/dark)
│   ├── api/v1/          route handlers: sessions, sessions/[id], openapi.json
│   └── docs/            Scalar API reference
├── components/          React UI: Home, Adoption, Settings, PiP view, CatCanvas…
├── hooks/
│   ├── usePomodoro.ts   engine + persistence + reactions + sound/notifications
│   └── useShortcuts.ts  keyboard shortcuts across the main and PiP windows
├── lib/
│   ├── timer.ts         pure Pomodoro engine (phases, energy, settings)
│   ├── storage.ts       versioned localStorage save, catch-up and day rollover
│   ├── browser.ts       WebAudio chiptunes, notifications, Document PiP
│   ├── history.ts       phase tracking, outbox and API client (local-first)
│   └── cat/
│       ├── config.ts    customization options and validation
│       ├── sprites.ts   pixel grids and layer composition
│       ├── palette.ts   colors per coat / eyes / accessory
│       ├── state.ts     timer → cat state → animation frame
│       └── render.ts    frame → RGBA pixels (cat, cushion, effects)
└── server/
    ├── db/              Drizzle schema + lazy pg pool (migrations in /drizzle)
    ├── http/problem.ts  RFC 9457 Problem Details + error wrapper
    ├── sessions/        Zod schemas, repository, HTTP handlers
    └── openapi.ts       OpenAPI 3.1 document built from the Zod schemas
tests/                   Vitest: engine, persistence, sprites, rendering, API, OpenAPI, history
```

### Pixel art without images

Each part of the cat (head, ears, eyes, mouth, body poses, tails, accessories) is a small grid of palette keys:

```ts
// left half of the head; sym() mirrors it into the full 20px-wide row
"....oooooo",
"..ooffffff",
".offfffpfp",   // o = outline, f = fur, p = tabby stripes
```

A frame is a stack of layers rasterized onto a 32×32 grid, then mapped to colors. So a new coat is just a new palette. Calico patches are blobs that recolor fur pixels, and pointed coats like the snowshoe swap in a masked head and draw ears, legs and tail with a separate color-point key. `render.ts` writes the result into a 48×44 RGBA buffer together with the cushion, hearts, `zZ` and the "!" bubble. The canvas shows it at native size, and CSS scales it up with `image-rendering: pixelated`.

Rendering is pure (state + time → pixels), so it is tested without a browser.

### Time and persistence

The engine never trusts `setInterval` to be regular: every tick advances by elapsed wall-clock time, so throttled background tabs stay accurate. On load, the saved timer is fast-forwarded by the time the app was closed, and any session that ended while you were away is waiting for you. Cycles and energy reset at local midnight, but a session that is running when the day changes is allowed to finish first.

### Floating window

`documentPictureInPicture.requestWindow()` opens a tiny always-on-top window. The page's stylesheets are copied into it and a React portal renders the mini view there. The cat's animation loop and an extra clock run on that window's own timers, so they stay smooth while the main tab is in the background. The button only appears in browsers that support the API.

---

## Out of scope for now

- Statistics endpoint and charts (streaks, weekly totals)
- Real accounts
- Customizable scenery
- More coats and accessories: adding one is a palette entry plus, for new shapes, a grid
- Sync across devices
