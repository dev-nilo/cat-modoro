import { describe, expect, it, vi } from "vitest";

import {
  emptyHistory,
  finish,
  flushOutbox,
  observe,
  OUTBOX_LIMIT,
  parseHistory,
  type HistoryState,
  type NewSession,
} from "@/lib/history";
import { DEFAULT_SETTINGS, FOCUS, initialState, LONG_BREAK, SHORT_BREAK, type TimerState } from "@/lib/timer";

const T0 = Date.UTC(2026, 9, 9, 13, 0);
const MIN = 60_000;
const timer = (over: Partial<TimerState> = {}): TimerState => ({ ...initialState(DEFAULT_SETTINGS), ...over });

describe("observe", () => {
  it("marks a phase as started the first time it runs", () => {
    const h = observe(emptyHistory(), timer({ running: true }), false, T0);
    expect(h.current).toEqual({ phase: FOCUS, startedAt: T0 });
  });

  it("keeps the original start across pauses", () => {
    let h = observe(emptyHistory(), timer({ running: true }), false, T0);
    h = observe(h, timer({ running: false, remaining: 600 }), false, T0 + 5 * MIN);
    h = observe(h, timer({ running: true, remaining: 600 }), false, T0 + 9 * MIN);
    expect(h.current?.startedAt).toBe(T0);
  });

  it("forgets a phase that was reset before finishing", () => {
    let h = observe(emptyHistory(), timer({ running: true }), false, T0);
    h = observe(h, timer(), true, T0 + MIN);
    expect(h.current).toBeNull();
  });

  it("returns the same object when nothing changed (so the hook skips writing)", () => {
    const h = observe(emptyHistory(), timer({ running: true }), false, T0);
    expect(observe(h, timer({ running: true, remaining: 100 }), false, T0 + MIN)).toBe(h);
  });
});

describe("finish", () => {
  const started: HistoryState = { current: { phase: FOCUS, startedAt: T0 }, outbox: [] };

  it("queues a record for the phase that ran", () => {
    const h = finish(started, { phase: FOCUS, outcome: "completed", endedAt: T0 + 25 * MIN, plannedSeconds: 1500 }, "id-1");
    expect(h.current).toBeNull();
    expect(h.outbox).toEqual([
      {
        id: "id-1",
        kind: "focus",
        outcome: "completed",
        startedAt: "2026-10-09T13:00:00.000Z",
        endedAt: "2026-10-09T13:25:00.000Z",
        plannedSeconds: 1500,
      },
    ]);
  });

  it.each([
    [SHORT_BREAK, "short_break"],
    [LONG_BREAK, "long_break"],
  ] as const)("maps %s to %s", (phase, kind) => {
    const h = finish({ current: { phase, startedAt: T0 }, outbox: [] }, { phase, outcome: "skipped", endedAt: T0 + MIN, plannedSeconds: 300 }, "x");
    expect(h.outbox[0]).toMatchObject({ kind, outcome: "skipped" });
  });

  it("records nothing for a phase skipped before it ever ran", () => {
    const h = finish(emptyHistory(), { phase: FOCUS, outcome: "skipped", endedAt: T0, plannedSeconds: 1500 }, "x");
    expect(h.outbox).toEqual([]);
  });

  it("caps the outbox, dropping the oldest", () => {
    const outbox = Array.from({ length: OUTBOX_LIMIT }, (_, i) => ({ id: `old-${i}` }) as NewSession);
    const h = finish({ ...started, outbox }, { phase: FOCUS, outcome: "completed", endedAt: T0 + MIN, plannedSeconds: 60 }, "new");
    expect(h.outbox).toHaveLength(OUTBOX_LIMIT);
    expect(h.outbox[0].id).toBe("old-1");
    expect(h.outbox.at(-1)?.id).toBe("new");
  });
});

describe("parseHistory", () => {
  it.each([null, "", "nope", "[]", '{"current":{"phase":1}}'])("survives %j", (raw) => {
    expect(parseHistory(raw)).toEqual(emptyHistory());
  });
});

describe("flushOutbox", () => {
  const records = ["a", "b", "c"].map((id) => ({ id }) as NewSession);
  const respond = (...statuses: (number | Error)[]) => {
    const fn = vi.fn<typeof fetch>();
    for (const s of statuses) {
      if (s instanceof Error) fn.mockRejectedValueOnce(s);
      else fn.mockResolvedValueOnce(new Response(null, { status: s === 204 ? 204 : s }));
    }
    return fn;
  };

  it("sends everything oldest first with the client id", async () => {
    const fetchImpl = respond(201, 200, 201);
    expect(await flushOutbox(records, "me", fetchImpl)).toEqual([]);
    expect(fetchImpl.mock.calls.map(([, init]) => JSON.parse(init!.body as string).id)).toEqual(["a", "b", "c"]);
    expect(new Headers(fetchImpl.mock.calls[0][1]!.headers).get("X-Client-Id")).toBe("me");
  });

  it.each([
    ["offline", new TypeError("Failed to fetch")],
    ["rate limited", 429],
    ["a server error", 503],
  ])("stops and keeps the rest when %s", async (_, failure) => {
    expect(await flushOutbox(records, "me", respond(201, failure))).toEqual(records.slice(1));
  });

  it("drops a record the API will never accept and carries on", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await flushOutbox(records, "me", respond(400, 409, 201))).toEqual([]);
  });
});
