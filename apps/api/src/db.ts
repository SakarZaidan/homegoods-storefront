import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://dara:dara@localhost:5432/dara', max: 15 });
export const db = drizzle(pool, { schema });
