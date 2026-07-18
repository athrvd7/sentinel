import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { credentialVerifier } from "@/lib/credential";
import { deriveAesKey, encryptText, type EncryptedEnvelope } from "@/lib/crypto";

const boundary = vi.hoisted(() => ({
  anchorCase: vi.fn(),
  anchorMessage: vi.fn(),
  create: vi.fn(),
  addMessage: vi.fn(),
  findById: vi.fn(),
  storeCiphertext: vi.fn(),
  unwrap: vi.fn()
}));

vi.mock("@/lib/chain", () => ({
  anchorCase: boundary.anchorCase,
  anchorMessage: boundary.anchorMessage
}));

vi.mock("@/lib/content-store", () => ({ storeCiphertext: boundary.storeCiphertext }));

vi.mock("@/lib/server", () => ({
  caseRepository: () => ({
    addMessage: boundary.addMessage,
    create: boundary.create,
    findById: boundary.findById
  })
}));

vi.mock("@/lib/investigator-keys", () => ({
  investigatorKeyStore: () => ({ unwrap: boundary.unwrap })
}));

vi.mock("@/lib/investigator-session", () => ({ isInvestigator: () => true }));

import { POST as submitCase } from "@/app/api/cases/route";
import { POST as sendPublicMessage } from "@/app/api/cases/[caseId]/messages/route";
import { POST as sendInvestigatorMessage } from "@/app/api/investigator/cases/[caseId]/messages/route";

const caseId = "case-id-12345678";
const secret = "u6zJ5veIg-PvQ9qjmUtlSITcbx6FSHjmqK1vQ3LmM7g";

function request(url: string, body: unknown, authorization?: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
    body: JSON.stringify(body)
  });
}

function tamper(envelope: EncryptedEnvelope): EncryptedEnvelope {
  const firstCharacter = envelope.ciphertext[0];

  return {
    ...envelope,
    ciphertext: `${firstCharacter === "A" ? "B" : "A"}${envelope.ciphertext.slice(1)}`
  };
}

async function encryptedEnvelope(value: string): Promise<EncryptedEnvelope> {
  return encryptText(value, await deriveAesKey(secret));
}

beforeEach(() => {
  vi.clearAllMocks();
  boundary.storeCiphertext.mockResolvedValue({ contentId: "local:content", contentHash: "content-hash" });
  boundary.anchorCase.mockResolvedValue("proof:case");
  boundary.anchorMessage.mockResolvedValue("proof:message");
  boundary.unwrap.mockReturnValue(secret);
  boundary.findById.mockReturnValue(undefined);
  boundary.create.mockImplementation((value) => value);
  boundary.addMessage.mockImplementation((value) => value);
});

describe("encrypted API ingress", () => {
  test("rejects a submission whose RSA-wrapped case key cannot be unwrapped", async () => {
    boundary.unwrap.mockImplementation(() => {
      throw new Error("Invalid RSA-OAEP ciphertext");
    });
    const response = await submitCase(
      request("/api/cases", {
        caseId,
        secretVerifier: await credentialVerifier(secret),
        envelope: JSON.stringify(await encryptedEnvelope("confidential evidence")),
        wrappedCaseKey: "invalid-rsa-wrapping"
      })
    );

    expect(response.status).toBe(400);
    expect(boundary.storeCiphertext).not.toHaveBeenCalled();
    expect(boundary.create).not.toHaveBeenCalled();
  });

  test("rejects a submission whose unwrapped secret does not match its verifier", async () => {
    const response = await submitCase(
      request("/api/cases", {
        caseId,
        secretVerifier: await credentialVerifier("a-different-case-secret"),
        envelope: JSON.stringify(await encryptedEnvelope("confidential evidence")),
        wrappedCaseKey: "valid-for-this-test"
      })
    );

    expect(response.status).toBe(400);
    expect(boundary.storeCiphertext).not.toHaveBeenCalled();
    expect(boundary.create).not.toHaveBeenCalled();
  });

  test("rejects a submission whose AES-GCM evidence cannot be authenticated", async () => {
    const response = await submitCase(
      request("/api/cases", {
        caseId,
        secretVerifier: await credentialVerifier(secret),
        envelope: JSON.stringify(tamper(await encryptedEnvelope("confidential evidence"))),
        wrappedCaseKey: "valid-for-this-test"
      })
    );

    expect(response.status).toBe(400);
    expect(boundary.storeCiphertext).not.toHaveBeenCalled();
    expect(boundary.create).not.toHaveBeenCalled();
  });

  test("rejects a public message whose AES-GCM envelope cannot be authenticated", async () => {
    boundary.findById.mockReturnValue({ caseId, secretVerifier: await credentialVerifier(secret) });
    const response = await sendPublicMessage(
      request(
        `/api/cases/${caseId}/messages`,
        { envelope: JSON.stringify(tamper(await encryptedEnvelope("anonymous reply"))) },
        `Case ${secret}`
      ),
      { params: Promise.resolve({ caseId }) }
    );

    expect(response.status).toBe(400);
    expect(boundary.storeCiphertext).not.toHaveBeenCalled();
    expect(boundary.addMessage).not.toHaveBeenCalled();
  });

  test("returns a JSON error when evidence storage or proof anchoring fails", async () => {
    boundary.anchorCase.mockRejectedValue(new Error("Blockchain relay is not configured"));
    const response = await submitCase(
      request("/api/cases", {
        caseId,
        secretVerifier: await credentialVerifier(secret),
        envelope: JSON.stringify(await encryptedEnvelope("confidential evidence")),
        wrappedCaseKey: "valid-for-this-test"
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Secure storage is unavailable" });
  });

  test("rejects an investigator message whose AES-GCM envelope cannot be authenticated", async () => {
    boundary.findById.mockReturnValue({ caseId, wrappedCaseKey: "valid-for-this-test" });
    const response = await sendInvestigatorMessage(
      request(`/api/investigator/cases/${caseId}/messages`, {
        envelope: JSON.stringify(tamper(await encryptedEnvelope("investigator reply")))
      }),
      { params: Promise.resolve({ caseId }) }
    );

    expect(response.status).toBe(400);
    expect(boundary.storeCiphertext).not.toHaveBeenCalled();
    expect(boundary.addMessage).not.toHaveBeenCalled();
  });
});
