import { NextRequest } from "next/server";
import { investigatorKeyStore } from "@/lib/investigator-keys";
import { verifyCaseIntegrity } from "@/lib/integrity";
import { isInvestigator } from "@/lib/investigator-session";
import { jsonError } from "@/lib/route-helpers";
import { caseRepository } from "@/lib/server";

export async function GET(request: NextRequest, context: RouteContext<"/api/investigator/cases/[caseId]">) {
  if (!isInvestigator(request)) {
    return jsonError("Unauthorized", 401);
  }

  const { caseId } = await context.params;
  const caseRecord = caseRepository().findById(caseId);

  if (!caseRecord) {
    return jsonError("Case not found", 404);
  }

  let integrity;
  try {
    integrity = await verifyCaseIntegrity(caseRecord);
  } catch {
    return jsonError("Evidence integrity could not be verified", 503);
  }

  if (!integrity) {
    return jsonError("Evidence integrity could not be verified", 409);
  }

  const safeCase = {
    caseId: caseRecord.caseId,
    envelope: caseRecord.envelope,
    contentId: caseRecord.contentId,
    proofRef: caseRecord.proofRef,
    status: caseRecord.status,
    createdAt: caseRecord.createdAt
  };

  return Response.json({
    case: safeCase,
    integrity,
    caseSecret: investigatorKeyStore().unwrap(caseRecord.wrappedCaseKey),
    messages: caseRepository().messagesFor(caseId)
  });
}
