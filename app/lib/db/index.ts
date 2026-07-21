import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (!process.env.PGUSER || !process.env.PGPASSWORD || !process.env.PGHOST || !process.env.PGPORT || !process.env.PGDATABASE) {
	throw new Error('Missing required PostgreSQL process.environment variables: PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE');
}

const dbUrl = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}?${process.env.PGSSL === 'true' ? 'channel_binding=require&sslmode=require' : '' }`;

export const client = postgres(dbUrl)
export const db = drizzle(client, { schema });
