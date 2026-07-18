import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { allowsLocalStorageFallback, readDevelopmentProofAnchor, storeDevelopmentProofAnchor } from "@/lib/content-store";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("content storage fallback", () => {
  test("allows the local content-addressed fallback only outside production", () => {
    expect(allowsLocalStorageFallback("development")).toBe(true);
    expect(allowsLocalStorageFallback("test")).toBe(true);
    expect(allowsLocalStorageFallback("production")).toBe(false);
  });

  test("loads an independent development proof only when its content address still matches", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "sentinel-proofs-"));
    temporaryDirectories.push(directory);
    const proof = {
      caseIdHash: "a".repeat(64),
      contentHash: "b".repeat(64),
      contentId: "local:evidence"
    };
    const proofRef = await storeDevelopmentProofAnchor(proof, directory);

    await expect(readDevelopmentProofAnchor(proofRef, directory)).resolves.toEqual(proof);
    writeFileSync(path.join(directory, "proofs", `${proofRef.slice("dev:case:".length)}.json`), JSON.stringify({ ...proof, contentHash: "c".repeat(64) }));
    await expect(readDevelopmentProofAnchor(proofRef, directory)).resolves.toBeUndefined();
  });
});
