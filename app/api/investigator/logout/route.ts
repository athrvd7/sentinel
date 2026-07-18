import { NextResponse } from "next/server";
import { investigatorCookie } from "@/lib/investigator-session";

export function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(investigatorCookie, "", { httpOnly: true, path: "/", maxAge: 0 });

  return response;
}
