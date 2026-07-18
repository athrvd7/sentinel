import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { anchorMessage } from "@/lib/chain";
import { storeCiphertext } from "@/lib/content-store";
import { sha256 } from "@/lib/crypto";
import { validateEncryptedEnvelope } from "@/lib/encrypted-ingress";
import { investigatorKeyStore } from "@/lib/investigator-keys";
import { isInvestigator } from "@/lib/investigator-session";
import { jsonError } from "@/lib/route-helpers";
import { caseRepository } from "@/lib/server";

export async function POST(request: NextRequest, context: RouteContext<"/api/investigator/cases/[caseId]/messages">) {
  if (!isInvestigator(request)) {
    return jsonError("Unauthorized", 401);
  }

  const { caseId } = await context.params;
  const body = (await request.json().catch(() => undefined)) as { envelope?: unknown } | undefined;

  const cases = caseRepository();
  const caseRecord = cases.findById(caseId);
  if (!caseRecord) {
    return jsonError("Case not found", 404);
  }

  let secret: string;
  try {
    secret = investigatorKeyStore().unwrap(caseRecord.wrappedCaseKey);
  } catch {
    return jsonError("Unable to send message", 400);
  }

  const encryptedMessage = await validateEncryptedEnvelope(body?.envelope, secret);
  if (!encryptedMessage) {
    return jsonError("Unable to send message", 400);
  }

  const { contentHash } = await storeCiphertext(encryptedMessage.serialized);
  const proofRef = await anchorMessage(await sha256(caseId), contentHash);
  const message = cases.addMessage({
    id: randomUUID(),
    caseId,
    author: "investigator",
    envelope: encryptedMessage.serialized,
    contentHash,
    proofRef
  });

  return Response.json({ message }, { status: 201 });
}
