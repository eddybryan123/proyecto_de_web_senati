import { NextRequest, NextResponse } from "next/server";
import { getSession, isUnauthorized, requireAdmin } from "@/lib/auth";
import { readRows } from "@/lib/db";
import { validateProduct } from "@/lib/products";
import type { Product } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const isAdmin = (await getSession())?.role === "admin";
  const products = await readRows<Product>(
    `SELECT id, name, description, price_cents AS priceCents, is_active AS isActive
     FROM products ${isAdmin ? "" : "WHERE is_active = 1"}
     ORDER BY created_at DESC, id DESC`,
  );
  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const authorization = await requireAdmin();
  if (isUnauthorized(authorization)) return authorization;

  const body = await request.json().catch(() => null);
  const product = validateProduct(body);
  if (!product) {
    return NextResponse.json({ error: "Revisa el nombre, la descripción, el precio y la disponibilidad del producto." }, { status: 400 });
  }

  const [created] = await readRows<Product>(
    `INSERT INTO products (name, description, price_cents, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, description, price_cents AS priceCents, is_active AS isActive`,
    [product.name, product.description, product.priceCents, product.isActive],
  );
  if (!created) throw new Error("No se pudo volver a cargar el producto recién creado.");
  return NextResponse.json(created, { status: 201 });
}
