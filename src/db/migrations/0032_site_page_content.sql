CREATE TABLE "site_pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_key" text NOT NULL,
  "draft_content" jsonb NOT NULL,
  "published_content" jsonb,
  "updated_by_user_id" text NOT NULL,
  "published_by_user_id" text,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "site_pages_page_key_unique" UNIQUE("page_key"),
  CONSTRAINT "site_pages_key_check" CHECK ("site_pages"."page_key" in ('home', 'about'))
);
--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_published_by_user_id_user_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
