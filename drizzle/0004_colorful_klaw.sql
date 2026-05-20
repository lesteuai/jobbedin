ALTER TABLE "cover_letter_history" ADD PRIMARY KEY ("job_id");--> statement-breakpoint
ALTER TABLE "message_gen_history" ADD PRIMARY KEY ("job_id");--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "resume_jobs" ADD COLUMN "name" text;