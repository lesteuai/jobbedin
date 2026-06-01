import { defineConfig } from 'drizzle-kit';

if (!process.env.PGUSER || !process.env.PGPASSWORD || !process.env.PGHOST || !process.env.PGPORT || !process.env.PGDATABASE) {
	throw new Error('Missing required PostgreSQL environment variables: PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE');
}

const dbUrl = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}?channel_binding=require&sslmode=require`;

export default defineConfig({
	schema: './app/lib/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url: dbUrl }
});
