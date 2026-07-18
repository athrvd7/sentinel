import { NextRequest } from "next/server";
import { isInvestigator } from "@/lib/investigator-session";
import { jsonError } from "@/lib/route-helpers";
import { caseRepository } from "@/lib/server";

export function GET(request: NextRequest) {
  if (!isInvestigator(request)) {
    return jsonError("Unauthorized", 401);
  }

  const cases = caseRepository().list().map((caseRecord) => ({
    caseId: caseRecord.caseId,
    contentId: caseRecord.contentId,
    proofRef: caseRecord.proofRef,
    status: caseRecord.status,
    createdAt: caseRecord.createdAt
  }));

  return Response.json({ cases });
}
