import { caseProofMatches, readAnchoredCaseProof } from "@/lib/chain";
import { sha256 } from "@/lib/crypto";
import type { PersistedCase } from "@/lib/repository";

export type CaseIntegrity = {
  proofRef: string;
  evidenceHash: string;
};

export async function verifyCaseIntegrity(caseRecord: Pick<PersistedCase, "caseId" | "envelope" | "contentId" | "proofRef">): Promise<CaseIntegrity | undefined> {
  const [caseIdHash, contentHash] = await Promise.all([sha256(caseRecord.caseId), sha256(caseRecord.envelope)]);
  const proof = await readAnchoredCaseProof(caseIdHash, caseRecord.proofRef);

  return caseProofMatches(proof, contentHash, caseRecord.contentId)
    ? { proofRef: caseRecord.proofRef, evidenceHash: contentHash }
    : undefined;
}
