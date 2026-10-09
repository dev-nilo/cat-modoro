CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"outcome" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"planned_seconds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_kind_check" CHECK ("sessions"."kind" in ('focus', 'short_break', 'long_break')),
	CONSTRAINT "sessions_outcome_check" CHECK ("sessions"."outcome" in ('completed', 'skipped')),
	CONSTRAINT "sessions_time_order_check" CHECK ("sessions"."ended_at" >= "sessions"."started_at"),
	CONSTRAINT "sessions_planned_check" CHECK ("sessions"."planned_seconds" > 0)
);
--> statement-breakpoint
CREATE INDEX "sessions_client_started_idx" ON "sessions" USING btree ("client_id","started_at" DESC NULLS LAST);