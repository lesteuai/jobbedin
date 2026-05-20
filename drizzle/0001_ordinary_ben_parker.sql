ALTER TABLE "companies" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "cover_letter_history" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "cover_letter_history" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "job_description_match" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "job_description_match" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "message_gen_history" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "message_gen_history" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "processes" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "resume_feedbacks" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "resume_feedbacks" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "resume_jobs" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "resume_jobs" ADD COLUMN "updated_at" timestamp;