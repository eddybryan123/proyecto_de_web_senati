import type { Product } from "@/lib/types";

export type ProductInput = Pick<Product, "name" | "description" | "priceCents" | "isActive">;

export function validateProduct(value: unknown): ProductInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const product = value as Partial<ProductInput>;
  if (
    typeof product.name !== "string" ||
    !product.name.trim() ||
    product.name.trim().length > 120 ||
    typeof product.description !== "string" ||
    product.description.length > 2000 ||
    !Number.isSafeInteger(product.priceCents) ||
    product.priceCents! < 1 ||
    product.priceCents! > 1_000_000_000 ||
    typeof product.isActive !== "boolean"
  ) {
    return null;
  }
  return {
    name: product.name.trim(),
    description: product.description.trim(),
    priceCents: product.priceCents!,
    isActive: product.isActive,
  };
}
