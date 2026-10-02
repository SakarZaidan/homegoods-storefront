import { defineConfig } from 'drizzle-kit';
export default defineConfig({ schema: './src/schema.ts', out: './drizzle', dialect: 'postgresql', dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://dara:dara@localhost:5432/dara' } });
