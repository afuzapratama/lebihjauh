CREATE TABLE "content_albums" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "name" text NOT NULL, "slug" text NOT NULL, "description" text DEFAULT '' NOT NULL, "publication_state" text DEFAULT 'draft' NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "content_albums_slug_unique" UNIQUE("slug"), CONSTRAINT "content_albums_state_check" CHECK ("content_albums"."publication_state" in ('draft', 'published'))
);
--> statement-breakpoint
CREATE TABLE "gallery_items" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "album_id" uuid, "image_url" text NOT NULL, "alt_text" text NOT NULL, "caption" text NOT NULL, "social_url" text, "publication_state" text DEFAULT 'draft' NOT NULL, "published_at" timestamp with time zone, "sort_order" integer DEFAULT 0 NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "gallery_items_state_check" CHECK ("gallery_items"."publication_state" in ('draft', 'published'))
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "title" text NOT NULL, "slug" text NOT NULL, "category" text NOT NULL, "excerpt" text NOT NULL, "body" text NOT NULL, "cover_image_url" text, "cover_alt_text" text DEFAULT '' NOT NULL, "social_url" text, "publication_state" text DEFAULT 'draft' NOT NULL, "published_at" timestamp with time zone, "created_by_user_id" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "news_articles_slug_unique" UNIQUE("slug"), CONSTRAINT "news_articles_state_check" CHECK ("news_articles"."publication_state" in ('draft', 'published'))
);
--> statement-breakpoint
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_album_id_content_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."content_albums"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
