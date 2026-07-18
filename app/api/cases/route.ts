import { NextRequest } from "next/server";
import { anchorCase } from "@/lib/chain";
import { storeCiphertext } from "@/lib/content-store";
import { sha256 } from "@/lib/crypto";
import { unwrapVerifiedCaseSecret, validateEncryptedEnvelope } from "@/lib/encrypted-ingress";
import { investigatorKeyStore } from "@/lib/investigator-keys";
import { jsonError } from "@/lib/route-helpers";
import { caseRepository } from "@/lib/server";

type Submission = {
  caseId?: unknown;
  secretVerifier?: unknown;
  envelope?: unknown;
  wrappedCaseKey?: unknown;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => undefined)) as Submission | undefined;

  if (
    !body ||
    typeof body.caseId !== "string" ||
    !/^[A-Za-z0-9_-]{16}$/.test(body.caseId) ||
    typeof body.secretVerifier !== "string" ||
    !/^[a-f0-9]{64}$/i.test(body.secretVerifier) ||
    typeof body.wrappedCaseKey !== "string" ||
    body.wrappedCaseKey.length === 0
  ) {
    return jsonError("Invalid encrypted submission", 400);
  }

  const secret = await unwrapVerifiedCaseSecret(body.wrappedCaseKey, body.secretVerifier, investigatorKeyStore());
  const encryptedEvidence = secret ? await validateEncryptedEnvelope(body.envelope, secret) : undefined;

  if (!encryptedEvidence) {
    return jsonError("Invalid encrypted submission", 400);
  }

  const cases = caseRepository();
  const existing = cases.findById(body.caseId);

  if (existing) {
    if (existing.secretVerifier === body.secretVerifier) {
      return Response.json({ caseId: existing.caseId, proofRef: existing.proofRef, idempotent: true });
    }

    return jsonError("Unable to create case", 409);
  }

  let contentId: string;
  let contentHash: string;
  let proofRef: string;
  try {
    ({ contentId, contentHash } = await storeCiphertext(encryptedEvidence.serialized));
    proofRef = await anchorCase(await sha256(body.caseId), contentHash, contentId);
  } catch {
    return jsonError("Secure storage is unavailable", 503);
  }

  cases.create({
    caseId: body.caseId,
    secretVerifier: body.secretVerifier,
    envelope: encryptedEvidence.serialized,
    evidenceHash: contentHash,
    contentId,
    proofRef,
    wrappedCaseKey: body.wrappedCaseKey
  });

  return Response.json({ caseId: body.caseId, proofRef, idempotent: false }, { status: 201 });
}
