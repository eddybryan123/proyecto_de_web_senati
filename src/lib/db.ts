import bcrypt from "bcryptjs";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const seedConfig = {
  name: "Nexo",
  description: "Ideas que impulsan el futuro.",
  primaryColor: "#6759E8",
  accentColor: "#C8F169",
  backgroundColor: "#F7F7FB",
  foregroundColor: "#191827",
  logoUrl: "",
};

type QueryValue = string | number | boolean | null | Date;
type QueryValues = QueryValue[];

const globalForDatabase = globalThis as typeof globalThis & {
  postgresPool?: Pool;
  postgresInitialization?: Promise<void>;
};

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Configura DATABASE_URL en .env.local con la conexión de tu base de datos PostgreSQL.");
  }
  if (!globalForDatabase.postgresPool) {
    globalForDatabase.postgresPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    globalForDatabase.postgresPool.on("error", (error) => {
      console.error("Error inesperado en la conexión inactiva de PostgreSQL:", error);
    });
  }
  return globalForDatabase.postgresPool;
}

async function initializeDatabase(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'editor'))
    );
    CREATE TABLE IF NOT EXISTS site_config (
      config_key TEXT PRIMARY KEY,
      config_value JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('draft', 'published')),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS page_components (
      id SERIAL PRIMARY KEY,
      page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK(position >= 0),
      type TEXT NOT NULL CHECK(type IN ('hero', 'text', 'cards', 'cta')),
      content_json JSONB NOT NULL CHECK(jsonb_typeof(content_json) = 'object'),
      UNIQUE(page_id, position)
    );
    CREATE TABLE IF NOT EXISTS menu_items (
      id SERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      href TEXT NOT NULL,
      position INTEGER NOT NULL UNIQUE CHECK(position >= 0),
      visible BOOLEAN NOT NULL DEFAULT TRUE
    );
  `);

  for (const [key, value] of Object.entries(seedConfig)) {
    await pool.query(
      "INSERT INTO site_config (config_key, config_value) VALUES ($1, $2::jsonb) ON CONFLICT (config_key) DO NOTHING",
      [key, JSON.stringify(value)],
    );
  }

  const pageResult = await pool.query<{ id: number }>(
    `INSERT INTO pages (title, slug, status)
     VALUES ('Inicio', 'inicio', 'published')
     ON CONFLICT (slug) DO NOTHING
     RETURNING id`,
  );
  if (pageResult.rowCount) {
    const pageId = pageResult.rows[0].id;
    const blocks = [
      {
        type: "hero",
        content: {
          eyebrow: "ESTUDIO DIGITAL INDEPENDIENTE",
          title: "Las buenas ideas merecen un gran comienzo.",
          body: "Diseñamos experiencias digitales para marcas que quieren dejar huella.",
          buttonText: "Conoce nuestro trabajo",
          buttonHref: "#servicios",
        },
      },
      {
        type: "cards",
        content: {
          eyebrow: "LO QUE HACEMOS",
          title: "Pensado para avanzar.",
          items: [
            { title: "Estrategia", body: "Encontramos la dirección correcta para cada reto." },
            { title: "Diseño", body: "Convertimos ideas complejas en experiencias sencillas." },
            { title: "Tecnología", body: "Creamos productos flexibles, rápidos y preparados para crecer." },
          ],
        },
      },
      {
        type: "cta",
        content: {
          title: "Tu próximo gran proyecto empieza aquí.",
          body: "Hablemos de lo que podemos crear juntos.",
          buttonText: "Escríbenos",
          buttonHref: "mailto:hola@nexo.studio",
        },
      },
    ];
    for (const [position, block] of blocks.entries()) {
      await pool.query(
        "INSERT INTO page_components (page_id, position, type, content_json) VALUES ($1, $2, $3, $4::jsonb)",
        [pageId, position, block.type, JSON.stringify(block.content)],
      );
    }
  }

  const menuItems = [
    ["Inicio", "/", 0],
    ["Servicios", "#servicios", 1],
    ["Contacto", "#contacto", 2],
  ] as const;
  for (const [label, href, position] of menuItems) {
    await pool.query(
      "INSERT INTO menu_items (label, href, position) VALUES ($1, $2, $3) ON CONFLICT (position) DO NOTHING",
      [label, href, position],
    );
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Configura ADMIN_EMAIL y ADMIN_PASSWORD en .env.local antes de iniciar la aplicación.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin') ON CONFLICT (email) DO NOTHING",
    [email.trim().toLowerCase(), passwordHash],
  );
}

export async function getDatabase(): Promise<Pool> {
  const pool = getPool();
  if (!globalForDatabase.postgresInitialization) {
    globalForDatabase.postgresInitialization = initializeDatabase().catch((error: unknown) => {
      globalForDatabase.postgresInitialization = undefined;
      throw error;
    });
  }
  await globalForDatabase.postgresInitialization;
  return pool;
}

export async function readRows<T extends QueryResultRow>(
  query: string,
  params: QueryValues = [],
): Promise<T[]> {
  const pool = await getDatabase();
  const result = await pool.query<T>(query, params);
  return result.rows;
}

export async function executeQuery(query: string, params: QueryValues = []): Promise<void> {
  const pool = await getDatabase();
  await pool.query(query, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = await getDatabase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
