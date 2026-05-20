ALTER TABLE "resumes" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "updated_at" timestamp;