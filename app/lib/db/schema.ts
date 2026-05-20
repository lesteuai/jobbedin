import { pgTable, uuid, text, pgEnum, json, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm/relations";

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

// Better-auth tables
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

// Existing tables with userId and .$onUpdate
export const resume = pgTable('resumes', {
  id: uuid('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name'),
  content: text('content'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
    .$onUpdate(() => new Date())
});

export const resumeJob = pgTable('resume_jobs', {
  id: uuid().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  resumeId: uuid('resume_id')
    .notNull()
    .references(() => resume.id, {onDelete: 'cascade'}),
  name: text('name'),
  content: text('content'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
    .$onUpdate(() => new Date())
});

export const company = pgTable('companies', {
  id: uuid().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id')
    .notNull()
    .references(() => resumeJob.id, {onDelete: 'cascade'}),
  content: text('content'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
    .$onUpdate(() => new Date())
});

export const jobDescriptionMatch = pgTable('job_description_match', {
  id: uuid().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id')
    .notNull()
    .references(() => resumeJob.id, {onDelete: 'cascade'}),
  content: text('content'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
    .$onUpdate(() => new Date())
});

export const resumeFeedback = pgTable('resume_feedbacks', {
  id: uuid().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id')
    .notNull()
    .references(() => resumeJob.id, {onDelete: 'cascade'}),
  content: text('content'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
    .$onUpdate(() => new Date())
});

export const coverLetterHistory = pgTable('cover_letter_history', {
  jobId: uuid('job_id')
      .primaryKey()
      .notNull()
      .references(() => resumeJob.id, {onDelete: 'cascade'}),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  conversation: json('conversation'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
    .$onUpdate(() => new Date())
});

export const messageGenHistory = pgTable('message_gen_history', {
  jobId: uuid('job_id')
      .primaryKey()
      .notNull()
      .references(() => resumeJob.id, {onDelete: 'cascade'}),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  conversation: json('conversation'),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
    .$onUpdate(() => new Date())
});

export const process = pgTable('processes', {
  id: uuid().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id')
    .notNull()
    .references(() => resumeJob.id, {onDelete: 'cascade'}),
  processType: processTypeEnum('process_type').notNull(),
  status: processStatusEnum('status').notNull().default(ProcessStatus.Pending),
	createdAt: timestamp('created_at').defaultNow(),
	updatedAt: timestamp('updated_at')
    .$onUpdate(() => new Date())
});

// Relations
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  resumes: many(resume),
  resumeJobs: many(resumeJob),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const resumeRelations = relations(resume, ({ one, many }) => ({
  user: one(user, { fields: [resume.userId], references: [user.id] }),
  resumeJobs: many(resumeJob),
}));

export const resumeJobRelations = relations(resumeJob, ({ one, many }) => ({
  user: one(user, { fields: [resumeJob.userId], references: [user.id] }),
  resume: one(resume, { fields: [resumeJob.resumeId], references: [resume.id] }),
  company: one(company, { fields: [resumeJob.id], references: [company.jobId] }),
  jobDescriptionMatch: one(jobDescriptionMatch, { fields: [resumeJob.id], references: [jobDescriptionMatch.jobId] }),
  resumeFeedback: one(resumeFeedback, { fields: [resumeJob.id], references: [resumeFeedback.jobId] }),
  coverLetterHistory: one(coverLetterHistory, { fields: [resumeJob.id], references: [coverLetterHistory.jobId] }),
  messageGenHistory: one(messageGenHistory, { fields: [resumeJob.id], references: [messageGenHistory.jobId] }),
  processes: many(process),
}));

export const companyRelations = relations(company, ({ one }) => ({
  user: one(user, { fields: [company.userId], references: [user.id] }),
  resumeJob: one(resumeJob, { fields: [company.jobId], references: [resumeJob.id] }),
}));

export const jobDescriptionMatchRelations = relations(jobDescriptionMatch, ({ one }) => ({
  user: one(user, { fields: [jobDescriptionMatch.userId], references: [user.id] }),
  resumeJob: one(resumeJob, { fields: [jobDescriptionMatch.jobId], references: [resumeJob.id] }),
}));

export const resumeFeedbackRelations = relations(resumeFeedback, ({ one }) => ({
  user: one(user, { fields: [resumeFeedback.userId], references: [user.id] }),
  resumeJob: one(resumeJob, { fields: [resumeFeedback.jobId], references: [resumeJob.id] }),
}));

export const coverLetterHistoryRelations = relations(coverLetterHistory, ({ one }) => ({
  user: one(user, { fields: [coverLetterHistory.userId], references: [user.id] }),
  resumeJob: one(resumeJob, { fields: [coverLetterHistory.jobId], references: [resumeJob.id] }),
}));

export const messageGenHistoryRelations = relations(messageGenHistory, ({ one }) => ({
  user: one(user, { fields: [messageGenHistory.userId], references: [user.id] }),
  resumeJob: one(resumeJob, { fields: [messageGenHistory.jobId], references: [resumeJob.id] }),
}));

export const processRelations = relations(process, ({ one }) => ({
  user: one(user, { fields: [process.userId], references: [user.id] }),
  resumeJob: one(resumeJob, { fields: [process.jobId], references: [resumeJob.id] }),
}));