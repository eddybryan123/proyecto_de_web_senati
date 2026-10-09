import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { readRows } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    !("email" in body) ||
    !("password" in body) ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json({ error: "Introduce un correo y una contraseña válidos." }, { status: 400 });
  }

  const [user] = await readRows<{ email: string; password_hash: string; role: string }>(
    "SELECT email, password_hash, role FROM users WHERE email = $1",
    [body.email.trim().toLowerCase()],
  );
  if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
    return NextResponse.json({ error: "El correo o la contraseña no son correctos." }, { status: 401 });
  }

  const token = await createSession(user.email, user.role);
  const response = NextResponse.json({ email: user.email, role: user.role });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
