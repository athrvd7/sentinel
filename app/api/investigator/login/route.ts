import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, resolveInvestigatorAuth, verifyPassword } from "@/lib/auth";
import { investigatorCookie } from "@/lib/investigator-session";
import { jsonError } from "@/lib/route-helpers";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => undefined)) as { password?: unknown } | undefined;
  const auth = resolveInvestigatorAuth();

  if (!auth || typeof body?.password !== "string" || !verifyPassword(body.password, auth.password)) {
    return jsonError("Invalid investigator credentials", 401);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(investigatorCookie, createSessionToken(auth.sessionSecret), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60
  });

  return response;
}
