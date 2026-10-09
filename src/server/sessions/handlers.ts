/**
 * HTTP layer of /api/v1/sessions. Built from a database getter so the route
 * files use the real Postgres and the tests use an in-memory PGlite.
 */

import { z } from "zod";

import type { Db } from "@/server/db/client";
import { ApiError, handle } from "@/server/http/problem";

import { createSession, deleteSession, findSession, listSessions } from "./repository";
import { ListQuery, NewSession, parseOrThrow } from "./schemas";

export const CLIENT_ID_HEADER = "X-Client-Id";
export const SESSIONS_PATH = "/api/v1/sessions";

type IdContext = { params: Promise<{ id: string }> };

const uuid = z.uuid();

/** The anonymous per-device identity every sessions endpoint is scoped to. */
function clientIdOf(req: Request): string {
  const id = req.headers.get(CLIENT_ID_HEADER);
  if (!id || !uuid.safeParse(id).success) {
    throw new ApiError("missing-client-id", `Send a UUID in the ${CLIENT_ID_HEADER} header.`);
  }
  return id;
}

/** A malformed id can't match any session, so it's a 404 rather than a 400. */
async function sessionIdOf(ctx: IdContext): Promise<string> {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) throw notFound(id);
  return id;
}

const notFound = (id: string) => new ApiError("session-not-found", `No session with id ${id}.`);

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError("validation", "The request body must be valid JSON.");
  }
}

export function sessionHandlers(getDb: () => Db) {
  return {
    /** GET /sessions?page&size&from&to */
    list: handle(async (req) => {
      const clientId = clientIdOf(req);
      const query = parseOrThrow(ListQuery, Object.fromEntries(new URL(req.url).searchParams), "query");
      return Response.json(await listSessions(getDb(), clientId, query));
    }),

    /** POST /sessions: 201 + Location, or 200 for an identical retry. */
    create: handle(async (req) => {
      const clientId = clientIdOf(req);
      const input = parseOrThrow(NewSession, await readJson(req), "body");
      const result = await createSession(getDb(), clientId, input);
      switch (result.status) {
        case "created":
        case "duplicate":
          return Response.json(result.session, {
            status: result.status === "created" ? 201 : 200,
            headers: { Location: `${SESSIONS_PATH}/${result.session.id}` },
          });
        case "conflict":
          throw new ApiError("session-conflict", `Session ${input.id} was already recorded with different data.`);
        case "foreign":
          throw notFound(input.id);
      }
    }),

    /** GET /sessions/{id} */
    get: handle(async (req, ctx: IdContext) => {
      const clientId = clientIdOf(req);
      const id = await sessionIdOf(ctx);
      const session = await findSession(getDb(), clientId, id);
      if (!session) throw notFound(id);
      return Response.json(session);
    }),

    /** DELETE /sessions/{id}: 204 */
    remove: handle(async (req, ctx: IdContext) => {
      const clientId = clientIdOf(req);
      const id = await sessionIdOf(ctx);
      if (!(await deleteSession(getDb(), clientId, id))) throw notFound(id);
      return new Response(null, { status: 204 });
    }),
  };
}
