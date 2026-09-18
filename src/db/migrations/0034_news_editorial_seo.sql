ALTER TABLE "news_articles" ADD COLUMN "author_name" text DEFAULT 'Tim LebihJauh' NOT NULL;
--> statement-breakpoint
ALTER TABLE "news_articles" ADD COLUMN "seo_title" text;
--> statement-breakpoint
ALTER TABLE "news_articles" ADD COLUMN "seo_description" text;
--> statement-breakpoint
ALTER TABLE "news_articles" ADD COLUMN "content_image_url" text;
--> statement-breakpoint
ALTER TABLE "news_articles" ADD COLUMN "content_image_alt" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "news_articles" ADD COLUMN "content_image_caption" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "news_articles" ADD COLUMN "related_trip_id" uuid;
--> statement-breakpoint
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_related_trip_id_trips_id_fk" FOREIGN KEY ("related_trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;
