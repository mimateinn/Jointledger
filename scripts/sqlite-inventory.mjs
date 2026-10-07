import { createClient } from "@libsql/client";

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/sqlite-inventory.mjs file:./data/foo.sqlite");
  process.exit(1);
}

const client = createClient({ url });
const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' ORDER BY name",
);
const names = tables.rows.map((row) => String(row.name));
const counts = {};
for (const name of names) {
  const result = await client.execute(`SELECT COUNT(*) AS n FROM "${name}"`);
  counts[name] = Number(result.rows[0]?.n ?? 0);
}
client.close();
console.log(JSON.stringify({ url, tables: names, counts, rows: Object.values(counts).reduce((a, b) => a + b, 0) }, null, 2));
