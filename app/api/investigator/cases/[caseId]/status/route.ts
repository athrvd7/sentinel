import { NextRequest } from "next/server";
import { anchorStatus } from "@/lib/chain";
import { sha256 } from "@/lib/crypto";
import { isInvestigator } from "@/lib/investigator-session";
import { jsonError } from "@/lib/route-helpers";
import { caseRepository } from "@/lib/server";

const statuses = new Set(["submitted", "under_review", "resolved"]);

export async function POST(request: NextRequest, context: RouteContext<"/api/investigator/cases/[caseId]/status">) {
  if (!isInvestigator(request)) {
    return jsonError("Unauthorized", 401);
  }

  const { caseId } = await context.params;
  const body = (await request.json().catch(() => undefined)) as { status?: unknown } | undefined;

  if (typeof body?.status !== "string" || !statuses.has(body.status)) {
    return jsonError("Invalid status", 400);
  }

  const cases = caseRepository();
  if (!cases.findById(caseId)) {
    return jsonError("Case not found", 404);
  }

  const proofRef = await anchorStatus(await sha256(caseId), body.status as "submitted" | "under_review" | "resolved");
  cases.updateStatus(caseId, body.status as "submitted" | "under_review" | "resolved", proofRef);

  return Response.json({ status: body.status, proofRef });
}
