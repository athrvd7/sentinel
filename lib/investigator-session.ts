import type { NextRequest } from "next/server";
import { resolveInvestigatorAuth, verifySessionToken } from "@/lib/auth";

export const investigatorCookie = "sentinel_investigator";

export function isInvestigator(request: NextRequest): boolean {
  const auth = resolveInvestigatorAuth();

  return Boolean(auth && verifySessionToken(request.cookies.get(investigatorCookie)?.value, auth.sessionSecret));
}
