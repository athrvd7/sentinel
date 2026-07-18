import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { CaseRepository } from "@/lib/repository";

const temporaryDirectories: string[] = [];

function repository(): CaseRepository {
  const directory = mkdtempSync(path.join(tmpdir(), "sentinel-proof-"));
  temporaryDirectories.push(directory);
  return new CaseRepository(path.join(directory, "sentinel.db"));
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("encrypted case repository", () => {
  test("stores an encrypted case and only returns it with its matching verifier", () => {
    const cases = repository();
    cases.create({
      caseId: "case-123",
      secretVerifier: "secret-hash",
      envelope: '{"ciphertext":"encrypted"}',
      evidenceHash: "evidence-hash",
      contentId: "local:evidence-hash",
      proofRef: "dev:case:evidence-hash",
      wrappedCaseKey: "wrapped-key"
    });

    expect(cases.findForSecret("case-123", "secret-hash")).toMatchObject({
      caseId: "case-123",
      envelope: '{"ciphertext":"encrypted"}',
      status: "submitted"
    });
    expect(cases.findForSecret("case-123", "wrong-hash")).toBeUndefined();
  });

  test("records encrypted messages and investigator status transitions", () => {
    const cases = repository();
    cases.create({
      caseId: "case-456",
      secretVerifier: "secret-hash",
      envelope: "encrypted-evidence",
      evidenceHash: "evidence-hash",
      contentId: "local:evidence-hash",
      proofRef: "dev:case:evidence-hash",
      wrappedCaseKey: "wrapped-key"
    });

    cases.addMessage({
      id: "message-1",
      caseId: "case-456",
      author: "whistleblower",
      envelope: "encrypted-message",
      contentHash: "message-hash",
      proofRef: "dev:message-hash"
    });
    cases.updateStatus("case-456", "under_review", "dev:status");

    expect(cases.findById("case-456")).toMatchObject({
      status: "under_review",
      proofRef: "dev:case:evidence-hash",
      statusProofRef: "dev:status"
    });
    expect(cases.messagesFor("case-456")).toHaveLength(1);
  });
});
