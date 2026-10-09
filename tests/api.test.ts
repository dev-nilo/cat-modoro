import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { sessionHandlers } from "@/server/sessions/handlers";

// The real migrations, run against an in-memory Postgres.
let db: Db;
beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "drizzle" });
  db = pg as unknown as Db;
});
beforeEach(async () => {
  await db.delete(schema.sessions);
});

const api = sessionHandlers(() => db);
const BASE = "http://test/api/v1/sessions";
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function request(method: string, path = "", opts: { client?: string | null; body?: unknown } = {}) {
  const headers = new Headers();
  const client = opts.client === undefined ? ALICE : opts.client;
  if (client) headers.set("X-Client-Id", client);
  const body = opts.body === undefined ? undefined : typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  return new Request(BASE + path, { method, headers, body });
}

let seq = 0;
function newSession(overrides: Record<string, unknown> = {}) {
  seq += 1;
  const started = Date.UTC(2026, 9, 1, 9, 0) + seq * 60 * 60_000;
  return {
    id: crypto.randomUUID(),
    kind: "focus",
    outcome: "completed",
    startedAt: new Date(started).toISOString(),
    endedAt: new Date(started + 25 * 60_000).toISOString(),
    plannedSeconds: 1500,
    ...overrides,
  };
}

const post = (body: unknown, client?: string | null) => api.create(request("POST", "", { body, client }), undefined);
const list = (query = "", client?: string) => api.list(request("GET", query, { client }), undefined);

async function expectProblem(res: Response, status: number, type: string) {
  expect(res.status).toBe(status);
  expect(res.headers.get("Content-Type")).toBe("application/problem+json");
  const body = await res.json();
  expect(body).toMatchObject({ type, status, title: expect.any(String) });
  return body;
}

describe("POST /sessions", () => {
  it("creates a session: 201 + Location", async () => {
    const input = newSession();
    const res = await post(input);
    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe(`/api/v1/sessions/${input.id}`);
    const body = await res.json();
    expect(body).toEqual({ ...input, createdAt: expect.any(String) });
    expect(body).not.toHaveProperty("clientId");
  });

  it("is idempotent: an identical retry is a 200 with the same Location", async () => {
    const input = newSession();
    await post(input);
    const res = await post(input);
    expect(res.status).toBe(200);
    expect(res.headers.get("Location")).toBe(`/api/v1/sessions/${input.id}`);
    expect((await list().then((r) => r.json())).page.totalElements).toBe(1);
  });

  it("treats the same instant in another offset as identical", async () => {
    const input = newSession({ startedAt: "2026-10-01T10:00:00Z", endedAt: "2026-10-01T10:25:00Z" });
    await post(input);
    const res = await post({ ...input, startedAt: "2026-10-01T07:00:00-03:00" });
    expect(res.status).toBe(200);
  });

  it("rejects re-using an id with different data: 409", async () => {
    const input = newSession();
    await post(input);
    await expectProblem(await post({ ...input, outcome: "skipped" }), 409, "/problems/session-conflict");
  });

  it("does not reveal another client's id: 404", async () => {
    const input = newSession();
    await post(input, BOB);
    await expectProblem(await post(input), 404, "/problems/session-not-found");
  });

  it("lists every invalid field: 400", async () => {
    const res = await post({ id: "nope", kind: "nap", startedAt: "yesterday", plannedSeconds: 0 });
    const body = await expectProblem(res, 400, "/problems/validation");
    const fields = body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining(["body.id", "body.kind", "body.outcome", "body.startedAt", "body.endedAt", "body.plannedSeconds"]),
    );
  });

  it.each([
    ["ends before it starts", { startedAt: "2026-10-01T10:00:00Z", endedAt: "2026-10-01T09:00:00Z" }],
    ["lasts more than 4 hours", { startedAt: "2026-10-01T10:00:00Z", endedAt: "2026-10-01T14:00:01Z" }],
    ["ends in the future", { startedAt: new Date().toISOString(), endedAt: new Date(Date.now() + 3_600_000).toISOString() }],
  ])("rejects a session that %s", async (_, times) => {
    const body = await expectProblem(await post(newSession(times)), 400, "/problems/validation");
    expect(body.errors).toEqual([{ field: "body.endedAt", message: expect.any(String) }]);
  });

  it("rejects a body that isn't JSON", async () => {
    await expectProblem(await post("{oops"), 400, "/problems/validation");
  });

  it.each([null, "not-a-uuid"])("requires a UUID X-Client-Id (got %j)", async (client) => {
    const body = await expectProblem(await post(newSession(), client), 400, "/problems/missing-client-id");
    expect(body.instance).toBe("/api/v1/sessions");
  });
});

describe("GET /sessions", () => {
  it("pages newest first with Spring-style metadata", async () => {
    const created = [];
    for (let i = 0; i < 5; i++) created.push(newSession());
    for (const s of created) await post(s);
    await post(newSession(), BOB);

    const res = await list("?page=1&size=2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toEqual({ number: 1, size: 2, totalElements: 5, totalPages: 3 });
    expect(body.content.map((s: { id: string }) => s.id)).toEqual([created[2].id, created[1].id]);
  });

  it("defaults to page 0, size 20", async () => {
    const body = await (await list()).json();
    expect(body).toEqual({ content: [], page: { number: 0, size: 20, totalElements: 0, totalPages: 0 } });
  });

  it("returns an empty page past the end", async () => {
    await post(newSession());
    const body = await (await list("?page=9")).json();
    expect(body.content).toEqual([]);
    expect(body.page.totalElements).toBe(1);
  });

  it("filters by start time with from (inclusive) and to (exclusive)", async () => {
    const a = newSession({ startedAt: "2026-10-01T08:00:00Z", endedAt: "2026-10-01T08:25:00Z" });
    const b = newSession({ startedAt: "2026-10-02T08:00:00Z", endedAt: "2026-10-02T08:25:00Z" });
    const c = newSession({ startedAt: "2026-10-03T08:00:00Z", endedAt: "2026-10-03T08:25:00Z" });
    for (const s of [a, b, c]) await post(s);
    const body = await (await list("?from=2026-10-02T08:00:00Z&to=2026-10-03T08:00:00Z")).json();
    expect(body.content.map((s: { id: string }) => s.id)).toEqual([b.id]);
  });

  it.each(["?size=101", "?size=0", "?page=-1", "?page=abc", "?from=monday", "?from=2026-10-02T00:00:00Z&to=2026-10-01T00:00:00Z"])(
    "rejects %s: 400",
    async (query) => {
      await expectProblem(await list(query), 400, "/problems/validation");
    },
  );
});

describe("GET /sessions/{id}", () => {
  it("returns the session", async () => {
    const input = newSession();
    await post(input);
    const res = await api.get(request("GET", `/${input.id}`), params(input.id));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject(input);
  });

  it.each([
    ["an unknown id", crypto.randomUUID()],
    ["a malformed id", "42"],
  ])("404s for %s", async (_, id) => {
    const res = await api.get(request("GET", `/${id}`), params(id));
    const body = await expectProblem(res, 404, "/problems/session-not-found");
    expect(body.instance).toBe(`/api/v1/sessions/${id}`);
  });

  it("404s for another client's session", async () => {
    const input = newSession();
    await post(input, BOB);
    await expectProblem(await api.get(request("GET", `/${input.id}`), params(input.id)), 404, "/problems/session-not-found");
  });
});

describe("DELETE /sessions/{id}", () => {
  it("deletes: 204, then 404", async () => {
    const input = newSession();
    await post(input);
    const res = await api.remove(request("DELETE", `/${input.id}`), params(input.id));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    await expectProblem(await api.remove(request("DELETE", `/${input.id}`), params(input.id)), 404, "/problems/session-not-found");
  });

  it("can't delete another client's session", async () => {
    const input = newSession();
    await post(input, BOB);
    await expectProblem(await api.remove(request("DELETE", `/${input.id}`), params(input.id)), 404, "/problems/session-not-found");
    expect((await list("", BOB).then((r) => r.json())).page.totalElements).toBe(1);
  });
});

describe("unexpected errors", () => {
  it("become a 500 without internals", async () => {
    const broken = sessionHandlers(() => {
      throw new Error("connection refused: secret-host:5432");
    });
    const res = await broken.list(request("GET"), undefined);
    const body = await expectProblem(res, 500, "about:blank");
    expect(JSON.stringify(body)).not.toContain("secret-host");
  });
});
