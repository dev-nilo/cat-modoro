import { defineConfig } from "drizzle-kit";

// Migrations run over the direct (unpooled) connection: PgBouncer's transaction
// mode doesn't support the session state migration tools rely on.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
