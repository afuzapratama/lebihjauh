ALTER TABLE "site_pages" DROP CONSTRAINT "site_pages_key_check";
--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_key_check" CHECK ("site_pages"."page_key" in ('home', 'about', 'global'));
