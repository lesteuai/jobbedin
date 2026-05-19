import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
// import * as schema from './schema';

if (!process.env.PG_USER || !process.env.PG_PASSWORD || !process.env.PG_HOST || !process.env.PG_PORT || !process.env.PG_DATABASE) {
	throw new Error('Missing required PostgreSQL process.environment variables: PG_USER, PG_PASSWORD, PG_HOST, PG_PORT, PG_DATABASE');
}

const dbUrl = `postgresql://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}`;

export const client = postgres(dbUrl, { prepare: false })
export const db = drizzle(client);
