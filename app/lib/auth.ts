import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';

const origin =
	process.env.NODE_ENV === 'production'
		? process.env.ORIGIN
		: process.env.ORIGIN_DEV ?? process.env.ORIGIN;

export const auth = betterAuth({
	baseURL: origin,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema,
	}),
	emailAndPassword: {
		enabled: true,
	},
});

export type Auth = typeof auth;
