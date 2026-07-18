import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { anchorMessage } from "@/lib/chain";
import { storeCiphertext } from "@/lib/content-store";
import { verifyCaseSecret } from "@/lib/credential";
import { sha256 } from "@/lib/crypto";
import { validateEncryptedEnvelope } from "@/lib/encrypted-ingress";
import { caseSecret, jsonError } from "@/lib/route-helpers";
import { caseRepository } from "@/lib/server";

export async function POST(request: NextRequest, context: RouteContext<"/api/cases/[caseId]/messages">) {
  const { caseId } = await context.params;
  const secret = caseSecret(request);
  const body = (await request.json().catch(() => undefined)) as { envelope?: unknown } | undefined;

  if (!secret) {
    return jsonError("Unable to send message", 400);
  }

  const cases = caseRepository();
  const caseRecord = cases.findById(caseId);

  if (!caseRecord || !(await verifyCaseSecret(secret, caseRecord.secretVerifier))) {
    return jsonError("Case not found", 404);
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
    author: "whistleblower",
    envelope: encryptedMessage.serialized,
    contentHash,
    proofRef
  });

  return Response.json({ message }, { status: 201 });
}
