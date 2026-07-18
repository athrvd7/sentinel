import { verifyCaseSecret } from "@/lib/credential";
import { decryptBytes, deriveAesKey, parseEncryptedEnvelope, type EncryptedEnvelope } from "@/lib/crypto";
import type { InvestigatorKeyStore } from "@/lib/investigator-keys";

export type ValidatedEnvelope = {
  envelope: EncryptedEnvelope;
  serialized: string;
};

export async function validateEncryptedEnvelope(value: unknown, secret: string): Promise<ValidatedEnvelope | undefined> {
  const envelope = parseEncryptedEnvelope(value);

  if (!envelope) {
    return undefined;
  }

  try {
    await decryptBytes(envelope, await deriveAesKey(secret));
  } catch {
    return undefined;
  }

  return { envelope, serialized: JSON.stringify(envelope) };
}

export async function unwrapVerifiedCaseSecret(
  wrappedCaseKey: string,
  secretVerifier: string,
  keyStore: InvestigatorKeyStore
): Promise<string | undefined> {
  let secret: string;
  try {
    secret = keyStore.unwrap(wrappedCaseKey);
  } catch {
    return undefined;
  }

  return (await verifyCaseSecret(secret, secretVerifier)) ? secret : undefined;
}
