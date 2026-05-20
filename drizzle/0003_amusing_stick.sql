ALTER TYPE "public"."job_type" RENAME TO "process_type";--> statement-breakpoint
ALTER TABLE "processes" RENAME COLUMN "job_type" TO "process_type";