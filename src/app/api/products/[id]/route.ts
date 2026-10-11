import { NextRequest, NextResponse } from "next/server";
import { isUnauthorized, requireAdmin } from "@/lib/auth";
import { executeQuery, readRows } from "@/lib/db";
import { validateProduct } from "@/lib/products";
import type { Product } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function productId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authorization = await requireAdmin();
  if (isUnauthorized(authorization)) return authorization;
  const { id: rawId } = await context.params;
  const id = productId(rawId);
  if (!id) return NextResponse.json({ error: "No se encontró el producto." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const product = validateProduct(body);
  if (!product) {
    return NextResponse.json({ error: "Revisa el nombre, la descripción, el precio y la disponibilidad del producto." }, { status: 400 });
  }
  const [existing] = await readRows<{ id: number }>("SELECT id FROM products WHERE id = $1", [id]);
  if (!existing) return NextResponse.json({ error: "No se encontró el producto." }, { status: 404 });

  await executeQuery(
    "UPDATE products SET name = $1, description = $2, price_cents = $3, is_active = $4 WHERE id = $5",
    [product.name, product.description, product.priceCents, product.isActive, id],
  );
  const [updated] = await readRows<Product>(
    "SELECT id, name, description, price_cents AS priceCents, is_active AS isActive FROM products WHERE id = $1",
    [id],
  );
  if (!updated) throw new Error("No se pudo volver a cargar el producto actualizado.");
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authorization = await requireAdmin();
  if (isUnauthorized(authorization)) return authorization;
  const { id: rawId } = await context.params;
  const id = productId(rawId);
  if (!id) return NextResponse.json({ error: "No se encontró el producto." }, { status: 404 });

  const [existing] = await readRows<{ id: number }>("SELECT id FROM products WHERE id = $1", [id]);
  if (!existing) return NextResponse.json({ error: "No se encontró el producto." }, { status: 404 });
  await executeQuery("DELETE FROM products WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
}
