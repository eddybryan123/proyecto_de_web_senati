import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { readRows } from "@/lib/db";
import type { SiteConfig } from "@/lib/types";
import "./globals.css";

export const dynamic = "force-dynamic";

async function getSiteConfig(): Promise<SiteConfig> {
  const settings = await readRows<{ config_key: keyof SiteConfig; config_value: unknown }>(
    "SELECT config_key, config_value FROM site_config",
  );
  return Object.fromEntries(
    settings.map(({ config_key, config_value }) => [config_key, config_value]),
  ) as SiteConfig;
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return {
    title: `${config.name} — Ideas en movimiento`,
    description: config.description,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const config = await getSiteConfig();
  const theme = {
    "--color-primary": config.primaryColor,
    "--color-accent": config.accentColor,
    "--color-site-bg": config.backgroundColor,
    "--color-site-fg": config.foregroundColor,
  } as CSSProperties;

  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body style={theme}>{children}</body>
    </html>
  );
}
