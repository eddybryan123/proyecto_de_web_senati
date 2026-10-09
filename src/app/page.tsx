import Link from "next/link";
import { SiteRenderer } from "@/components/site-renderer";
import { readRows } from "@/lib/db";
import type { Page, PageComponent } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [page] = await readRows<Omit<Page, "components">>(
    "SELECT id, title, slug, status, updated_at AS updatedAt FROM pages WHERE slug = 'inicio' AND status = 'published'",
  );
  if (!page) {
    return (
      <main className="empty-site">
        <p>Este sitio todavía no tiene una página de inicio publicada.</p>
        <Link href="/admin">Abrir el panel de control</Link>
      </main>
    );
  }
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
