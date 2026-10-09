/**
 * Postgres connection. Created lazily so `next build` never needs DATABASE_URL.
 *
 * On Vercel (Fluid Compute) one function instance serves many requests, so a
 * small `pg` pool is reused across them; `attachDatabasePool` closes idle
 * clients before the instance is suspended.
 */

import { attachDatabasePool } from "@vercel/functions";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

/** Any Drizzle Postgres database with our schema: node-postgres in production, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Db | null = null;

export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const pool = new Pool({ connectionString: url, max: 5 });
    attachDatabasePool(pool);
    db = drizzle(pool, { schema });
  }
  return db;
}
