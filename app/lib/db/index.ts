import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (!process.env.PGUSER || !process.env.PGPASSWORD || !process.env.PGHOST || !process.env.PGPORT || !process.env.PGDATABASE) {
	throw new Error('Missing required PostgreSQL process.environment variables: PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE');
}

const dbUrl = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}?channel_binding=require&sslmode=require`;

export const client = postgres(dbUrl, { prepare: false })
export const db = drizzle(client, { schema });
