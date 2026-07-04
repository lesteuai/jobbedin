import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/app/lib/db';
import * as schema from '@/app/lib/db/schema';
import { sendEmail, EMAIL_ENABLED } from '@/app/lib/email';

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
		requireEmailVerification: EMAIL_ENABLED,
		sendResetPassword: async ({ user, url }) => {
			void sendEmail({
				to: user.email,
				subject: 'Reset your JobbedIn password',
				text: `Click the link to reset your password: ${url}`,
			});
		},
	},
	emailVerification: {
		sendOnSignUp: EMAIL_ENABLED,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async ({ user, url }) => {
			void sendEmail({
				to: user.email,
				subject: 'Verify your JobbedIn email',
				text: `Click the link to verify your email: ${url}`,
			});
		},
	},
	user: {
		deleteUser: {
			enabled: true,
			sendDeleteAccountVerification: async ({ user, url }) => {
				void sendEmail({
					to: user.email,
					subject: 'Confirm your JobbedIn account deletion',
					text: `Click the link to confirm account deletion: ${url}`,
				});
			},
		},
	},
});

export type Auth = typeof auth;
