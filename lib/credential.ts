import { bytesToBase64Url } from "@/lib/encoding";
import { sha256 } from "@/lib/crypto";

export type CaseCredential = {
  caseId: string;
  secret: string;
  display: string;
};

const credentialPattern = /^SP-([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{43})$/;

function randomToken(byteLength: number): string {
  return bytesToBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function createCaseCredential(): CaseCredential {
  const caseId = randomToken(12);
  const secret = randomToken(32);

  return { caseId, secret, display: `SP-${caseId}.${secret}` };
}

export function parseCaseCredential(value: string): Pick<CaseCredential, "caseId" | "secret"> {
  const match = credentialPattern.exec(value.trim());

  if (!match) {
    throw new Error("Invalid case credential");
  }

  return { caseId: match[1], secret: match[2] };
}

export function credentialVerifier(secret: string): Promise<string> {
  return sha256(secret);
}

export async function verifyCaseSecret(secret: string, verifier: string): Promise<boolean> {
  const candidate = await credentialVerifier(secret);
  const length = Math.max(candidate.length, verifier.length);
  let difference = candidate.length ^ verifier.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (candidate.charCodeAt(index) || 0) ^ (verifier.charCodeAt(index) || 0);
  }

  return difference === 0;
}
