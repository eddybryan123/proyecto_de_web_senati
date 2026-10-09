import { NextRequest, NextResponse } from "next/server";
import { getSession, isUnauthorized, requireAdmin } from "@/lib/auth";
import { readRows } from "@/lib/db";
import type { Page, PageComponent } from "@/lib/types";

export const runtime = "nodejs";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getPageComponents(pageId: number): Promise<PageComponent[]> {
  const blocks = await readRows<{ id: number; type: PageComponent["type"]; content_json: Record<string, unknown>; position: number }>(
    "SELECT id, type, content_json, position FROM page_components WHERE page_id = $1 ORDER BY position",
    [pageId],
  );
  return blocks.map((block) => ({
    id: block.id,
    type: block.type,
    content: block.content_json,
    position: block.position,
  }));
}

export async function GET() {
  const session = await getSession();
  const includeDrafts = session?.role === "admin";
  const pages = await readRows<Omit<Page, "components">>(
    `SELECT id, title, slug, status, updated_at AS "updatedAt" FROM pages ${includeDrafts ? "" : "WHERE status = 'published'"} ORDER BY updated_at DESC`,
  );
  return NextResponse.json(await Promise.all(
    pages.map(async (page) => ({ ...page, components: await getPageComponents(page.id) })),
  ));
}

export async function POST(request: NextRequest) {
  const authorization = await requireAdmin();
  if (isUnauthorized(authorization)) return authorization;

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("title" in body) || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "El título es obligatorio." }, { status: 400 });
  }
  const title = body.title.trim().slice(0, 120);
  const slug = "slug" in body && typeof body.slug === "string" ? slugify(body.slug) : slugify(title);
  if (!slug) return NextResponse.json({ error: "Escribe un título o URL válida." }, { status: 400 });

  try {
    const [created] = await readRows<{ id: number; updatedAt: string }>(
      `INSERT INTO pages (title, slug, status)
       VALUES ($1, $2, 'draft')
       RETURNING id, updated_at AS "updatedAt"`,
      [title, slug],
    );
    if (!created) throw new Error("PostgreSQL no devolvió la página recién creada.");
    return NextResponse.json(
      { ...created, title, slug, status: "draft", components: [] },
      { status: 201 },
    );
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "Ya existe una página con esa URL." }, { status: 409 });
    }
    throw error;
  }
}
