import { pgTable, uuid, text, pgEnum, json, timestamp } from "drizzle-orm/pg-core";

export enum ProcessStatus {
	Pending = 'pending',
	Processing = 'processing',
	Done = 'done',
	Failed = 'failed',
}

export const processStatusEnum = pgEnum('process_status', [
  ProcessStatus.Pending,
  ProcessStatus.Processing,
  ProcessStatus.Done,
  ProcessStatus.Failed,
] as const);

export enum ProcessType {
	Company = 'company',
	JDMatch = 'jdmatch',
	ResumeFeedback = 'feedback',
	Letter = 'letter',
	Message = 'message',
}

export const processTypeEnum = pgEnum('process_type', [
  ProcessType.Company,
  ProcessType.JDMatch,
  ProcessType.ResumeFeedback,
  ProcessType.Letter,
  ProcessType.Message,
] as const);

export const resume = pgTable('resumes', {
  id: uuid('id').primaryKey(),
  name: text('name'),
  content: text('content'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
});

export const resumeJob = pgTable('resume_jobs', {
  id: uuid().primaryKey(),
  resumeId: uuid('resume_id')
    .notNull()
    .references(() => resume.id, {onDelete: 'cascade'}),
  name: text('name'),
  content: text('content'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
});

export const company = pgTable('companies', {
  id: uuid().primaryKey(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => resumeJob.id, {onDelete: 'cascade'}),
  content: text('content'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
});

export const jobDescriptionMatch = pgTable('job_description_match', {
  id: uuid().primaryKey(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => resumeJob.id, {onDelete: 'cascade'}),
  content: text('content'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
});

export const resumeFeedback = pgTable('resume_feedbacks', {
  id: uuid().primaryKey(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => resumeJob.id, {onDelete: 'cascade'}),
  content: text('content'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
});

export const coverLetterHistory = pgTable('cover_letter_history', {
  jobId: uuid('job_id')
      .primaryKey()
      .notNull()
      .references(() => resumeJob.id, {onDelete: 'cascade'}),
  conversation: json('conversation'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
});

export const messageGenHistory = pgTable('message_gen_history', {
  jobId: uuid('job_id')
      .primaryKey()
      .notNull()
      .references(() => resumeJob.id, {onDelete: 'cascade'}),
  conversation: json('conversation'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
});

export const process = pgTable('processes', {
  id: uuid().primaryKey(),
  jobId: uuid('job_id')
    .notNull()
    .references(() => resumeJob.id, {onDelete: 'cascade'}),
  processType: processTypeEnum('process_type').notNull(),
  status: processStatusEnum('status').notNull().default(ProcessStatus.Pending),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
});