import { NextRequest } from "next/server";
import { verifyCaseSecret } from "@/lib/credential";
import { verifyCaseIntegrity } from "@/lib/integrity";
import { caseSecret, jsonError } from "@/lib/route-helpers";
import { caseRepository } from "@/lib/server";

export async function GET(request: NextRequest, context: RouteContext<"/api/cases/[caseId]">) {
  const { caseId } = await context.params;
  const secret = caseSecret(request);
  const caseRecord = caseRepository().findById(caseId);

  if (!secret || !caseRecord || !(await verifyCaseSecret(secret, caseRecord.secretVerifier))) {
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
    status: caseRecord.status,
    createdAt: caseRecord.createdAt
  };

  return Response.json({
    case: safeCase,
    integrity,
    messages: caseRepository().messagesFor(caseId)
  });
}
