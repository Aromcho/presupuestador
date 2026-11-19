CREATE TABLE "marketing_pending" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"status" text DEFAULT 'Abierto' NOT NULL,
	"answer" text,
	"from_panel" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_pending_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "marketing_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"date" text NOT NULL,
	"status" text DEFAULT 'idea' NOT NULL,
	"status_from_panel" boolean DEFAULT false NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_posts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "marketing_resources" (
	"code" text PRIMARY KEY NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "marketing_posts_date_idx" ON "marketing_posts" USING btree ("date");