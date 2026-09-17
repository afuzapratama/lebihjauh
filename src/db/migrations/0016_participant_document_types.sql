ALTER TABLE "booking_participants" DROP CONSTRAINT "booking_participants_identity_type_check";
--> statement-breakpoint
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_identity_type_check" CHECK ("booking_participants"."identity_type" in ('nik', 'ktp', 'sim', 'student_card', 'passport', 'kitas'));
