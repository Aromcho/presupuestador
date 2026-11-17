CREATE TYPE "public"."currency" AS ENUM('ARS', 'USD');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('EQUIPO', 'REPUESTO', 'MATERIAL', 'MANO_DE_OBRA', 'SERVICIO');--> statement-breakpoint
CREATE TYPE "public"."note_rule" AS ENUM('SIEMPRE', 'SI_PRODUCTOS', 'SI_MANO_DE_OBRA', 'SI_SIN_INSTALACION', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."price_rule" AS ENUM('COSTO_MAS_MARGEN', 'LISTA_MENOS_DESCUENTO', 'PRECIO_FIJO');--> statement-breakpoint
CREATE TYPE "public"."quote_mode" AS ENUM('SUMA', 'COMPARATIVA');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('BORRADOR', 'ENVIADO', 'ACEPTADO', 'RECHAZADO', 'VENCIDO');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'VENTAS');--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"summary" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_name_unique" UNIQUE("name"),
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"zone" text,
	"address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"buy" numeric(14, 2),
	"sell" numeric(14, 2) NOT NULL,
	"quoted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "item_type" DEFAULT 'EQUIPO' NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"description" text,
	"brand_id" uuid,
	"price_list_id" uuid,
	"media_id" uuid,
	"currency" "currency" DEFAULT 'ARS' NOT NULL,
	"list_price" numeric(14, 2) DEFAULT 0 NOT NULL,
	"rule_override" "price_rule",
	"percent_override" numeric(6, 2),
	"iva_included" boolean DEFAULT true NOT NULL,
	"iva_rate" numeric(6, 2) DEFAULT 21 NOT NULL,
	"unit" text DEFAULT 'u.' NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"variants" jsonb,
	"width" integer,
	"height" integer,
	"mime" text,
	"size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"rule" "note_rule" DEFAULT 'SIEMPRE' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand_id" uuid,
	"currency" "currency" DEFAULT 'ARS' NOT NULL,
	"rule" "price_rule" DEFAULT 'PRECIO_FIJO' NOT NULL,
	"percent" numeric(6, 2) DEFAULT 0 NOT NULL,
	"iva_included" boolean DEFAULT true NOT NULL,
	"iva_rate" numeric(6, 2) DEFAULT 21 NOT NULL,
	"valid_from" timestamp with time zone,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"label" text DEFAULT 'Opción A' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"item_id" uuid,
	"type" "item_type" NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"description" text,
	"photo_path" text,
	"unit_price" integer NOT NULL,
	"qty" numeric(10, 2) DEFAULT 1 NOT NULL,
	"discount_pct" numeric(6, 2) DEFAULT 0 NOT NULL,
	"iva_included" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"client_id" uuid,
	"template_id" uuid,
	"user_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"mode" "quote_mode" DEFAULT 'SUMA' NOT NULL,
	"status" "quote_status" DEFAULT 'BORRADOR' NOT NULL,
	"validity_hours" integer DEFAULT 48 NOT NULL,
	"payment_terms" text,
	"se_incluye" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text[] DEFAULT '{}'::text[] NOT NULL,
	"observations" text,
	"dollar_sell" numeric(14, 2),
	"dollar_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"qty" numeric(10, 2) DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"icon" text DEFAULT 'instalacion' NOT NULL,
	"mode" "quote_mode" DEFAULT 'SUMA' NOT NULL,
	"se_incluye" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'VENTAS' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_groups" ADD CONSTRAINT "quote_groups_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_group_id_quote_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."quote_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_items" ADD CONSTRAINT "template_items_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_items" ADD CONSTRAINT "template_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_created_idx" ON "activity" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "clients_name_idx" ON "clients" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "items_brand_code_unique" ON "items" USING btree ("brand_id","code");--> statement-breakpoint
CREATE INDEX "items_type_idx" ON "items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "items_list_idx" ON "items" USING btree ("price_list_id");--> statement-breakpoint
CREATE INDEX "items_code_idx" ON "items" USING btree ("code");--> statement-breakpoint
CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotes_client_idx" ON "quotes" USING btree ("client_id");