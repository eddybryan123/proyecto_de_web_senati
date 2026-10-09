import { notFound } from "next/navigation";
import { SiteRenderer } from "@/components/site-renderer";
import { readRows } from "@/lib/db";
import type { Page, PageComponent } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [page] = await readRows<Omit<Page, "components">>(
    "SELECT id, title, slug, status, updated_at AS updatedAt FROM pages WHERE slug = $1 AND status = 'published'",
    [slug],
  );
  if (!page) notFound();
  const rows = await readRows<{ id: number; type: PageComponent["type"]; content_json: Record<string, unknown>; position: number }>(
    "SELECT id, type, content_json, position FROM page_components WHERE page_id = $1 ORDER BY position",
    [page.id],
  );
  const components = rows.map((block) => ({
    id: block.id,
    type: block.type,
    content: block.content_json,
    position: block.position,
  }));
  return <SiteRenderer components={components} />;
}
