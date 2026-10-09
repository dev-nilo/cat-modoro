/**
 * Data access for sessions. Every query is scoped to one client: another
 * client's session is indistinguishable from one that doesn't exist.
 */

import { and, count, desc, eq, gte, lt, type SQL } from "drizzle-orm";

import type { Db } from "@/server/db/client";
import { sessions, type SessionRow } from "@/server/db/schema";

import type { ListQuery, NewSession, Session, SessionPage } from "./schemas";

export function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    kind: row.kind,
    outcome: row.outcome,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt.toISOString(),
    plannedSeconds: row.plannedSeconds,
    createdAt: row.createdAt.toISOString(),
  };
}

export type CreateResult =
  | { status: "created"; session: Session }
  /** Same id, same data: a retry. */
  | { status: "duplicate"; session: Session }
  /** Same id, different data. */
  | { status: "conflict" }
  /** The id belongs to another client. */
  | { status: "foreign" };

export async function createSession(db: Db, clientId: string, input: NewSession): Promise<CreateResult> {
  const values = {
    id: input.id,
    clientId,
    kind: input.kind,
    outcome: input.outcome,
    startedAt: new Date(input.startedAt),
    endedAt: new Date(input.endedAt),
    plannedSeconds: input.plannedSeconds,
  };

  // ON CONFLICT keeps concurrent retries race-free: exactly one insert wins.
  const [inserted] = await db.insert(sessions).values(values).onConflictDoNothing({ target: sessions.id }).returning();
  if (inserted) return { status: "created", session: toSession(inserted) };

  const [existing] = await db.select().from(sessions).where(eq(sessions.id, input.id));
  if (!existing || existing.clientId !== clientId) return { status: "foreign" };
  const same =
    existing.kind === values.kind &&
    existing.outcome === values.outcome &&
    existing.startedAt.getTime() === values.startedAt.getTime() &&
    existing.endedAt.getTime() === values.endedAt.getTime() &&
    existing.plannedSeconds === values.plannedSeconds;
  return same ? { status: "duplicate", session: toSession(existing) } : { status: "conflict" };
}

export async function findSession(db: Db, clientId: string, id: string): Promise<Session | null> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.clientId, clientId)));
  return row ? toSession(row) : null;
}

export async function listSessions(db: Db, clientId: string, query: ListQuery): Promise<SessionPage> {
  const filters: SQL[] = [eq(sessions.clientId, clientId)];
  if (query.from) filters.push(gte(sessions.startedAt, new Date(query.from)));
  if (query.to) filters.push(lt(sessions.startedAt, new Date(query.to)));
  const where = and(...filters);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(sessions)
      .where(where)
      .orderBy(desc(sessions.startedAt), desc(sessions.id))
      .limit(query.size)
      .offset(query.page * query.size),
    db.select({ total: count() }).from(sessions).where(where),
  ]);

  return {
    content: rows.map(toSession),
    page: {
      number: query.page,
      size: query.size,
      totalElements: total,
      totalPages: Math.ceil(total / query.size),
    },
  };
}

/** Returns whether a session was deleted. */
export async function deleteSession(db: Db, clientId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.clientId, clientId)))
    .returning({ id: sessions.id });
  return deleted.length > 0;
}
