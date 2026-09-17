ALTER TABLE "payments" ADD COLUMN "received_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "payments" SET "received_at" = "submitted_at" WHERE "received_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "received_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "received_at" SET NOT NULL;
