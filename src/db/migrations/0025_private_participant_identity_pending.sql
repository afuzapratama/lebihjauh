ALTER TABLE "booking_participants" ALTER COLUMN "identity_type" SET DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE "booking_participants" DROP CONSTRAINT "booking_participants_identity_type_check";
--> statement-breakpoint
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_identity_type_check" CHECK ("booking_participants"."identity_type" in ('pending', 'nik', 'ktp', 'sim', 'student_card', 'passport', 'kitas'));