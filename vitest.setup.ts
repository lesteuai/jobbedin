// Env vars read at module import time by app/lib code (db client, crypto, LLM factories).
// Set here so tests never depend on a local .env file.
process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret-0123456789abcdef';
process.env.PGUSER = 'test-pguser';
process.env.PGPASSWORD = 'test-pgpassword';
process.env.PGHOST = 'localhost';
process.env.PGPORT = '5432';
process.env.PGDATABASE = 'test-pgdatabase';
process.env.OPENROUTER_API_KEY = 'test-openrouter-api-key';
process.env.TAVILY_API_KEY = 'test-tavily-api-key';
