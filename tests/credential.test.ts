import { describe, expect, test } from "vitest";
import {
  createCaseCredential,
  credentialVerifier,
  parseCaseCredential,
  verifyCaseSecret
} from "@/lib/credential";

describe("case credentials", () => {
  test("creates a parseable random credential and verifies its secret", async () => {
    const credential = createCaseCredential();
    const parsed = parseCaseCredential(credential.display);

    expect(parsed).toEqual({ caseId: credential.caseId, secret: credential.secret });
    expect(await verifyCaseSecret(parsed.secret, await credentialVerifier(credential.secret))).toBe(true);
  });

  test("rejects malformed credentials and a wrong secret", async () => {
    const credential = createCaseCredential();

    expect(() => parseCaseCredential("unsafe-link-token")).toThrow("Invalid case credential");
    expect(await verifyCaseSecret("wrong-secret", await credentialVerifier(credential.secret))).toBe(false);
  });
});
