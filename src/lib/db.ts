import bcrypt from "bcryptjs";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const seedConfig = {
  name: "Nexo",
  description: "Audífonos, laptops y accesorios para conectarte mejor.",
  primaryColor: "#6759E8",
  accentColor: "#C8F169",
  backgroundColor: "#F7F7FB",
  foregroundColor: "#191827",
  logoUrl: "",
  whatsappPhone: "",
};

type QueryValue = string | number | boolean | null | Date | Uint8Array;
type QueryValues = QueryValue[];
type QueryResult<T> = { rows: T[]; rowCount: number };
type QueryClient = { query<T = Record<string, unknown>>(query: string, params?: QueryValues): Promise<QueryResult<T>> };

const globalForDatabase = globalThis as typeof globalThis & {
  sqliteDatabase?: Database;
  sqliteInitialization?: Promise<Database>;
  sqliteTransactionQueue?: Promise<void>;
  sqliteLibrary?: Promise<SqlJsStatic>;
  sqlitePath?: string;
};

function getDatabasePath(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? "data/cms.sqlite");
}

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!globalForDatabase.sqliteLibrary) {
    globalForDatabase.sqliteLibrary = initSqlJs({
      locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
    });
  }
  return globalForDatabase.sqliteLibrary;
}

function persistDatabase(database: Database): void {
  const databasePath = globalForDatabase.sqlitePath;
  if (!databasePath) throw new Error("No se pudo resolver la ruta del archivo SQLite.");
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const temporaryPath = `${databasePath}.tmp`;
  writeFileSync(temporaryPath, Buffer.from(database.export()));
  renameSync(temporaryPath, databasePath);
}

function toSqliteQuery(query: string): string {
  return query.replace(/\$([1-9]\d*)/g, "?$1").replace(/::jsonb\b/gi, "");
}

function toSqliteValue(value: QueryValue): string | number | null | Uint8Array {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

function runQuery<T>(database: Database, query: string, params: QueryValues = []): QueryResult<T> {
  const statement = database.prepare(toSqliteQuery(query));
  try {
    statement.bind(params.map(toSqliteValue));
    const rows: T[] = [];
    while (statement.step()) {
      const row = statement.getAsObject() as Record<string, unknown>;
      for (const key of ["config_value", "content_json"]) {
        if (typeof row[key] === "string") row[key] = JSON.parse(row[key]);
      }
      for (const key of ["visible", "is_active", "isActive"]) {
        if (typeof row[key] === "number") row[key] = row[key] === 1;
      }
      rows.push(row as T);
    }
    return { rows, rowCount: rows.length || database.getRowsModified() };
  } finally {
    statement.free();
  }
}

async function initializeDatabase(): Promise<Database> {
  const databasePath = getDatabasePath();
  const SQL = await getSqlJs();
  const database = new SQL.Database(
    existsSync(/*turbopackIgnore: true*/ databasePath)
      ? readFileSync(/*turbopackIgnore: true*/ databasePath)
      : undefined,
  );
  const [productTable] = runQuery<{ count: number }>(
    database,
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'products'",
  ).rows;
  const isNewProductCatalog = productTable?.count === 0;
  globalForDatabase.sqlitePath = databasePath;
  globalForDatabase.sqliteDatabase = database;
  database.run("PRAGMA foreign_keys = ON");
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'editor'))
    );
    CREATE TABLE IF NOT EXISTS site_config (
      config_key TEXT PRIMARY KEY,
      config_value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('draft', 'published')),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS page_components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK(position >= 0),
      type TEXT NOT NULL CHECK(type IN ('hero', 'text', 'cards', 'cta')),
      content_json TEXT NOT NULL CHECK(json_valid(content_json)),
      UNIQUE(page_id, position)
    );
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      href TEXT NOT NULL,
      position INTEGER NOT NULL UNIQUE CHECK(position >= 0),
      visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  for (const [key, value] of Object.entries(seedConfig)) {
    database.run(
      "INSERT INTO site_config (config_key, config_value) VALUES (?, ?) ON CONFLICT (config_key) DO NOTHING",
      [key, JSON.stringify(value)],
    );
  }

  const [descriptionRow] = runQuery<{ config_value: unknown }>(
    database,
    "SELECT config_value FROM site_config WHERE config_key = ?",
    ["description"],
  ).rows;
  if (
    descriptionRow &&
    (descriptionRow.config_value === "Ideas que impulsan el futuro." ||
      descriptionRow.config_value === "Encuentra algo especial en nuestra tienda.")
  ) {
    database.run(
      "UPDATE site_config SET config_value = ? WHERE config_key = 'description'",
      [JSON.stringify(seedConfig.description)],
    );
  }

  if (isNewProductCatalog) {
    const sampleProducts = [
      ["Audífonos Bluetooth", "Audio inalámbrico para música, llamadas y el uso diario.", 12990],
      ["Laptop para estudio y trabajo", "Una opción versátil para tus tareas, clases y proyectos.", 249990],
      ["Mouse inalámbrico", "Conexión inalámbrica para completar tu espacio de trabajo.", 4990],
      ["Teclado mecánico compacto", "Un formato compacto para tu escritorio o zona de estudio.", 18990],
    ] as const;
    for (const [name, description, priceCents] of sampleProducts) {
      database.run(
        "INSERT INTO products (name, description, price_cents) VALUES (?, ?, ?)",
        [name, description, priceCents],
      );
    }
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Configura ADMIN_EMAIL y ADMIN_PASSWORD en .env.local antes de iniciar la aplicación.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  database.run(
    "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin') ON CONFLICT (email) DO NOTHING",
    [email.trim().toLowerCase(), passwordHash],
  );

  persistDatabase(database);
  return database;
}

export async function getDatabase(): Promise<Database> {
  const databasePath = getDatabasePath();
  if (globalForDatabase.sqliteDatabase && globalForDatabase.sqlitePath === databasePath) {
    return globalForDatabase.sqliteDatabase;
  }
  if (!globalForDatabase.sqliteInitialization || globalForDatabase.sqlitePath !== databasePath) {
    globalForDatabase.sqlitePath = databasePath;
    globalForDatabase.sqliteInitialization = initializeDatabase().catch((error: unknown) => {
      globalForDatabase.sqliteInitialization = undefined;
      globalForDatabase.sqliteDatabase = undefined;
      globalForDatabase.sqlitePath = undefined;
      throw error;
    });
  }
  return globalForDatabase.sqliteInitialization;
}

async function waitForTransactions(): Promise<void> {
  await globalForDatabase.sqliteTransactionQueue;
}

export async function readRows<T = Record<string, unknown>>(
  query: string,
  params: QueryValues = [],
): Promise<T[]> {
  await waitForTransactions();
  const database = await getDatabase();
  const result = runQuery<T>(database, query, params);
  if (/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(query)) persistDatabase(database);
  return result.rows;
}

export async function executeQuery(query: string, params: QueryValues = []): Promise<void> {
  await waitForTransactions();
  const database = await getDatabase();
  runQuery(database, query, params);
  persistDatabase(database);
}

export async function withTransaction<T>(callback: (client: QueryClient) => Promise<T>): Promise<T> {
  const previousTransaction = globalForDatabase.sqliteTransactionQueue;
  let releaseTransaction: () => void = () => {};
  const currentTransaction = new Promise<void>((resolve) => {
    releaseTransaction = resolve;
  });
  globalForDatabase.sqliteTransactionQueue = currentTransaction;
  try {
    await previousTransaction;
    const database = await getDatabase();
    database.run("BEGIN");
    let transactionOpen = true;
    try {
      const result = await callback({
        query: async <Row = Record<string, unknown>>(query: string, params: QueryValues = []) =>
          runQuery<Row>(database, query, params),
      });
      database.run("COMMIT");
      transactionOpen = false;
      persistDatabase(database);
      return result;
    } catch (error) {
      if (transactionOpen) database.run("ROLLBACK");
      throw error;
    }
  } finally {
    releaseTransaction();
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}
