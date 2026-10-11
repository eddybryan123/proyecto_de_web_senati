import { Storefront } from "@/components/storefront";
import { readRows } from "@/lib/db";
import type { Product, SiteConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [settings, products] = await Promise.all([
    readRows<{ config_key: keyof SiteConfig; config_value: unknown }>(
      "SELECT config_key, config_value FROM site_config",
    ),
    readRows<Product>(
      `SELECT id, name, description, price_cents AS priceCents, is_active AS isActive
       FROM products WHERE is_active = 1 ORDER BY created_at DESC, id DESC`,
    ),
  ]);
  const config = Object.fromEntries(
    settings.map(({ config_key, config_value }) => [config_key, config_value]),
  ) as SiteConfig;

  return <Storefront config={config} products={products} />;
}
