import { NextRequest, NextResponse } from "next/server";
import { isUnauthorized, requireAdmin } from "@/lib/auth";
import { readRows, withTransaction } from "@/lib/db";
import type { SiteConfig } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const rows = await readRows<{ config_key: keyof SiteConfig; config_value: unknown }>(
    "SELECT config_key, config_value FROM site_config",
  );
  const config = Object.fromEntries(rows.map((row) => [row.config_key, row.config_value]));
  return NextResponse.json(config);
}

export async function PATCH(request: NextRequest) {
  const authorization = await requireAdmin();
  if (isUnauthorized(authorization)) return authorization;

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "La configuración enviada no es válida." }, { status: 400 });
  }
  const config = body as Partial<SiteConfig>;
  const allowedFields = ["name", "description", "logoUrl", "primaryColor", "accentColor", "backgroundColor", "foregroundColor", "whatsappPhone"];
  const invalidField = Object.keys(config).find((key) => !allowedFields.includes(key));
  if (invalidField) {
    return NextResponse.json({ error: `La propiedad ${invalidField} no está permitida.` }, { status: 400 });
  }
  const textFields: (keyof SiteConfig)[] = ["name", "description", "logoUrl", "whatsappPhone"];
  const colorFields: (keyof SiteConfig)[] = [
    "primaryColor",
    "accentColor",
    "backgroundColor",
    "foregroundColor",
  ];
  for (const key of textFields) {
    if (config[key] !== undefined && (typeof config[key] !== "string" || config[key].length > 300)) {
      return NextResponse.json({ error: `El valor de ${key} debe ser texto de hasta 300 caracteres.` }, { status: 400 });
    }
  }
  if (config.logoUrl !== undefined && config.logoUrl !== "" && !/^\/uploads\/[0-9a-f-]+-\d+\.webp$/i.test(config.logoUrl)) {
    return NextResponse.json({ error: "El logotipo debe ser una imagen cargada desde el panel." }, { status: 400 });
  }
  if (config.whatsappPhone !== undefined && config.whatsappPhone !== "") {
    const digits = typeof config.whatsappPhone === "string" ? config.whatsappPhone.replace(/\D/g, "") : "";
    if (!/^[+\d\s()-]+$/.test(config.whatsappPhone) || digits.length < 8 || digits.length > 15) {
      return NextResponse.json({ error: "El WhatsApp debe incluir entre 8 y 15 dígitos con código de país." }, { status: 400 });
    }
  }
  for (const key of colorFields) {
    if (config[key] !== undefined && (typeof config[key] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(config[key]))) {
      return NextResponse.json({ error: `El color ${key} debe usar el formato hexadecimal #RRGGBB.` }, { status: 400 });
    }
  }

  for (const [key, value] of Object.entries(config)) {
    if (typeof value !== "string") {
      return NextResponse.json({ error: `El valor de ${key} debe ser texto.` }, { status: 400 });
    }
  }
  await withTransaction(async (client) => {
    for (const [key, value] of Object.entries(config)) {
      await client.query(
        "INSERT INTO site_config (config_key, config_value) VALUES ($1, $2::jsonb) ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value",
        [key, JSON.stringify(value)],
      );
    }
  });
  return NextResponse.json(config);
}
