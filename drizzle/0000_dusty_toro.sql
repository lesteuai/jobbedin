CREATE TYPE "public"."job_type" AS ENUM('company', 'jdmatch', 'feedback', 'letter', 'message');--> statement-breakpoint
CREATE TYPE "public"."process_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"content" text
);
--> statement-breakpoint
CREATE TABLE "cover_letter_history" (
	"job_id" uuid NOT NULL,
	"conversation" json
);
--> statement-breakpoint
CREATE TABLE "job_description_match" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"content" text
);
--> statement-breakpoint
CREATE TABLE "message_gen_history" (
	"job_id" uuid NOT NULL,
	"conversation" json
);
--> statement-breakpoint
CREATE TABLE "processes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"job_type" "job_type" NOT NULL,
	"status" "process_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"content" text
);
--> statement-breakpoint
CREATE TABLE "resume_feedbacks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"content" text
);
--> statement-breakpoint
CREATE TABLE "resume_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"resume_id" uuid NOT NULL,
	"content" text
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_job_id_resume_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."resume_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_letter_history" ADD CONSTRAINT "cover_letter_history_job_id_resume_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."resume_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_description_match" ADD CONSTRAINT "job_description_match_job_id_resume_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."resume_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_gen_history" ADD CONSTRAINT "message_gen_history_job_id_resume_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."resume_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processes" ADD CONSTRAINT "processes_job_id_resume_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."resume_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_feedbacks" ADD CONSTRAINT "resume_feedbacks_job_id_resume_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."resume_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_jobs" ADD CONSTRAINT "resume_jobs_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;