import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { isUnauthorized, requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const maxFileSize = 8 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: NextRequest) {
  const authorization = await requireAdmin();
  if (isUnauthorized(authorization)) return authorization;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size === 0 || file.size > maxFileSize) {
    return NextResponse.json({ error: "Selecciona una imagen JPG, PNG, WebP o AVIF de hasta 8 MB." }, { status: 400 });
  }
  const input = Buffer.from(await file.arrayBuffer());
  const outputDirectory = path.join(process.cwd(), "public", "uploads");
  await mkdir(outputDirectory, { recursive: true });
  const fileBase = randomUUID();
  const metadata = await sharp(input, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height) {
    return NextResponse.json({ error: "El archivo no contiene una imagen válida." }, { status: 400 });
  }

  const imageWidth = [5, 6, 7, 8].includes(metadata.orientation ?? 0) ? metadata.height : metadata.width;
  const maxWidth = Math.min(imageWidth ?? metadata.width, 1600);
  const uniqueWidths = [...new Set([480, 960, maxWidth].filter((width) => width < maxWidth).concat(maxWidth))];
  for (const width of uniqueWidths) {
    await sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(outputDirectory, `${fileBase}-${width}.webp`));
  }
  const srcSet = uniqueWidths.map((width) => `/uploads/${fileBase}-${width}.webp ${width}w`).join(", ");
  return NextResponse.json({
    src: `/uploads/${fileBase}-${uniqueWidths[uniqueWidths.length - 1]}.webp`,
    srcSet,
    alt: file.name.replace(/\.[^.]+$/, "").slice(0, 120),
  }, { status: 201 });
}
