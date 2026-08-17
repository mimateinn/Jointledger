import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle as drizzleSqlite } from "drizzle-orm/libsql";
import { migrate as migrateSqlite } from "drizzle-orm/libsql/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import {
  ensureSqliteDir,
  getDatabaseUrl,
  isPostgresUrl,
} from "./dialect";

async function main() {
  const url = getDatabaseUrl();
  if (isPostgresUrl(url)) {
    const sql = postgres(url, { max: 1 });
    const db = drizzlePg(sql);
    await migratePg(db, { migrationsFolder: "./drizzle" });
    await sql.end();
    console.log("Migrations applied.");
    return;
  }

  ensureSqliteDir(url);
  const client = createClient({ url });
  await client.execute("PRAGMA foreign_keys = OFF");
  const db = drizzleSqlite(client);
  await migrateSqlite(db, { migrationsFolder: "./drizzle-sqlite" });
  await client.execute("PRAGMA foreign_keys = ON");
  client.close();
  console.log("Migrations applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
