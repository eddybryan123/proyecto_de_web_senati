import { NextRequest, NextResponse } from "next/server";
import { getSession, isUnauthorized, requireAdmin } from "@/lib/auth";
import { executeQuery, isUniqueConstraintError, readRows, withTransaction } from "@/lib/db";
import type { Page, PageComponent } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
type PageRow = { id: number; title: string; slug: string; status: Page["status"]; updatedAt: string };

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function findPage(id: string): Promise<PageRow | undefined> {
  const parsedId = Number(id);
  const isId = Number.isSafeInteger(parsedId) && parsedId > 0;
  const [page] = await readRows<PageRow>(
    `SELECT id, title, slug, status, updated_at AS "updatedAt" FROM pages WHERE ${isId ? "id = $1" : "slug = $1"}`,
    [isId ? parsedId : id],
  );
  return page;
}

async function getComponents(pageId: number): Promise<PageComponent[]> {
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

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const page = await findPage(id);
  if (!page) return NextResponse.json({ error: "No se encontró la página." }, { status: 404 });
  const session = await getSession();
  if (page.status !== "published" && session?.role !== "admin") {
    return NextResponse.json({ error: "No se encontró la página." }, { status: 404 });
  }
  return NextResponse.json({ ...page, components: await getComponents(page.id) });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authorization = await requireAdmin();
  if (isUnauthorized(authorization)) return authorization;
  const { id } = await context.params;
  const page = await findPage(id);
  if (!page) return NextResponse.json({ error: "No se encontró la página." }, { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Los datos enviados no son válidos." }, { status: 400 });
  }
  const data = body as { title?: unknown; slug?: unknown; status?: unknown; components?: unknown };
  const title = data.title === undefined ? page.title : typeof data.title === "string" ? data.title.trim().slice(0, 120) : "";
  const slug = data.slug === undefined ? page.slug : typeof data.slug === "string" ? slugify(data.slug) : "";
  const status = data.status === undefined ? page.status : data.status;
  if (!title || !slug || (status !== "draft" && status !== "published")) {
    return NextResponse.json({ error: "Revisa el título, la URL y el estado de la página." }, { status: 400 });
  }
  const components = data.components;
  if (components !== undefined && (
    !Array.isArray(components) ||
    components.length > 50 ||
    components.some((component) => !component || typeof component !== "object" ||
      !["hero", "text", "cards", "cta"].includes(component.type) ||
      !component.content || typeof component.content !== "object" || Array.isArray(component.content) ||
      JSON.stringify(component.content).length > 20000)
  )) {
    return NextResponse.json({ error: "Los bloques enviados no son válidos o superan el límite permitido." }, { status: 400 });
  }

  try {
    await withTransaction(async (client) => {
      await client.query(
        "UPDATE pages SET title = $1, slug = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
        [title, slug, status, page.id],
      );
      if (Array.isArray(components)) {
        await client.query("DELETE FROM page_components WHERE page_id = $1", [page.id]);
        for (const [position, component] of (components as PageComponent[]).entries()) {
          await client.query(
            "INSERT INTO page_components (page_id, position, type, content_json) VALUES ($1, $2, $3, $4::jsonb)",
            [page.id, position, component.type, JSON.stringify(component.content)],
          );
        }
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "Ya existe una página con esa URL." }, { status: 409 });
    }
    throw error;
  }
  const [updated] = await readRows<PageRow>(
    'SELECT id, title, slug, status, updated_at AS "updatedAt" FROM pages WHERE id = $1',
    [page.id],
  );
  if (!updated) throw new Error("No se pudo volver a cargar la página actualizada.");
  return NextResponse.json({ ...updated, components: await getComponents(page.id) });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authorization = await requireAdmin();
  if (isUnauthorized(authorization)) return authorization;
  const { id } = await context.params;
  const page = await findPage(id);
  if (!page) return NextResponse.json({ error: "No se encontró la página." }, { status: 404 });
  await executeQuery("DELETE FROM pages WHERE id = $1", [page.id]);
  return NextResponse.json({ success: true });
}
