import type { NextRequest } from "next/server";

export function caseSecret(request: NextRequest): string | undefined {
  const authorization = request.headers.get("authorization");

  return authorization?.startsWith("Case ") ? authorization.slice(5) : undefined;
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
