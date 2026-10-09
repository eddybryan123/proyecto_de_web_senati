import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "nexo_session";
const sessionDurationSeconds = 60 * 60 * 8;

function getSigningKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET es obligatorio y debe tener al menos 32 caracteres.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(email: string, role: string): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${sessionDurationSeconds}s`)
    .sign(getSigningKey());
}

export async function getSession(): Promise<{ email: string; role: string } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSigningKey());
    if (!payload.sub || typeof payload.role !== "string") return null;
    return { email: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return { email: session.email };
}

export function isUnauthorized(value: { email: string } | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
