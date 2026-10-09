import { NextRequest, NextResponse } from "next/server";
import { isUnauthorized, requireAdmin } from "@/lib/auth";
import { readRows, withTransaction } from "@/lib/db";
import type { MenuItem } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const items = await readRows<MenuItem>(
    "SELECT id, label, href, position, visible FROM menu_items ORDER BY position",
  );
  return NextResponse.json(items);
}

export async function PUT(request: NextRequest) {
  const authorization = await requireAdmin();
  if (isUnauthorized(authorization)) return authorization;

  const body: unknown = await request.json().catch(() => null);
  if (!Array.isArray(body) || body.length > 20) {
    return NextResponse.json({ error: "Envía una lista de hasta 20 enlaces." }, { status: 400 });
  }
  const items = body as Partial<MenuItem>[];
  if (items.some((item) =>
    typeof item.label !== "string" ||
    item.label.trim().length === 0 ||
    item.label.length > 50 ||
    typeof item.href !== "string" ||
    item.href.length > 300 ||
    !(item.href.startsWith("/") && !item.href.startsWith("//")) && !item.href.startsWith("https://") && !item.href.startsWith("mailto:") ||
    /[\u0000-\u001f]/.test(item.href) ||
    item.href.includes("\\") ||
    typeof item.visible !== "boolean"
  )) {
    return NextResponse.json({ error: "Revisa el texto, el destino y la visibilidad de los enlaces." }, { status: 400 });
  }

  await withTransaction(async (client) => {
    await client.query("DELETE FROM menu_items");
    for (const [position, item] of items.entries()) {
      await client.query(
        "INSERT INTO menu_items (label, href, position, visible) VALUES ($1, $2, $3, $4)",
        [item.label!.trim(), item.href!.trim(), position, item.visible!],
      );
    }
  });
  return NextResponse.json({ success: true });
}
