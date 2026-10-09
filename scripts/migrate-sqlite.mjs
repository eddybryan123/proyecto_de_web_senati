import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";
import { Pool } from "pg";

const sourcePath = path.resolve(process.argv[2] ?? "data/cms.sqlite");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Falta DATABASE_URL. Configura la conexión PostgreSQL en .env.local.");
}
if (!existsSync(sourcePath)) {
  throw new Error(`No se encontró la base SQLite para migrar: ${sourcePath}`);
}

const SQL = await initSqlJs({
  locateFile: (file) => path.resolve("node_modules/sql.js/dist", file),
});
const sqlite = new SQL.Database(readFileSync(sourcePath));
const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

function readAll(query) {
  const statement = sqlite.prepare(query);
  const rows = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

const requiredTables = await pool.query(
  "SELECT to_regclass('public.pages') AS pages, to_regclass('public.site_config') AS site_config, to_regclass('public.page_components') AS page_components",
);
if (Object.values(requiredTables.rows[0]).some((table) => table === null)) {
  throw new Error("Primero inicia la aplicación con PostgreSQL para crear el esquema y luego ejecuta la migración.");
}

const users = readAll("SELECT email, password_hash, role FROM users");
const config = readAll("SELECT config_key, config_value FROM site_config");
const pages = readAll("SELECT id, title, slug, status, updated_at FROM pages ORDER BY id");
const components = readAll("SELECT page_id, position, type, content_json FROM page_components ORDER BY page_id, position");
const menu = readAll("SELECT label, href, position, visible FROM menu_items ORDER BY position");
const pageIds = new Map();

const client = await pool.connect();
try {
  await client.query("BEGIN");

  for (const user of users) {
    await client.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [user.email, user.password_hash, user.role],
    );
  }

  for (const setting of config) {
    await client.query(
      `INSERT INTO site_config (config_key, config_value)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value`,
      [setting.config_key, JSON.stringify(JSON.parse(setting.config_value))],
    );
  }

  for (const page of pages) {
    const result = await client.query(
      `INSERT INTO pages (title, slug, status, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE
       SET title = EXCLUDED.title, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
       RETURNING id`,
      [page.title, page.slug, page.status, page.updated_at],
    );
    pageIds.set(page.id, result.rows[0].id);
    await client.query("DELETE FROM page_components WHERE page_id = $1", [result.rows[0].id]);
  }

  for (const component of components) {
    const targetPageId = pageIds.get(component.page_id);
    if (!targetPageId) continue;
    await client.query(
      "INSERT INTO page_components (page_id, position, type, content_json) VALUES ($1, $2, $3, $4::jsonb)",
      [targetPageId, component.position, component.type, JSON.stringify(JSON.parse(component.content_json))],
    );
  }

  await client.query("DELETE FROM menu_items");
  for (const item of menu) {
    await client.query(
      "INSERT INTO menu_items (label, href, position, visible) VALUES ($1, $2, $3, $4)",
      [item.label, item.href, item.position, Boolean(item.visible)],
    );
  }

  await client.query("COMMIT");
  console.log(`Migración completada: ${users.length} usuarios, ${config.length} ajustes, ${pages.length} páginas, ${components.length} bloques y ${menu.length} enlaces.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
  sqlite.close();
}
