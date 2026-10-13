import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis;

export const pool =
  globalForDb.__bugreplayPool ??
  new Pool({ connectionString: databaseUrl, max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__bugreplayPool = pool;
}

export const db = drizzle(pool, { schema });
