import { afterEach, describe, expect, test } from "vitest";
import { anchorCase, caseProofMatches } from "@/lib/chain";

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) delete process.env[key];
  }
  Object.assign(process.env, originalEnvironment);
});

describe("chain relay", () => {
  test("refuses an unconfigured relay in production instead of returning a development proof", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.REGISTRY_ADDRESS;
    delete process.env.RELAY_PRIVATE_KEY;

    await expect(anchorCase("a".repeat(64), "b".repeat(64), "local:evidence")).rejects.toThrow(
      "Blockchain relay is not configured"
    );
  });

  test("treats malformed relay settings as unconfigured outside production", async () => {
    process.env.NODE_ENV = "development";
    process.env.REGISTRY_ADDRESS = "not-an-address";
    process.env.RELAY_PRIVATE_KEY = "not-a-private-key";

    await expect(anchorCase("a".repeat(64), "b".repeat(64), "local:evidence")).resolves.toMatch(/^dev:case:/);
  });

  test("accepts evidence only when the independently anchored proof matches its content hash and identifier", () => {
    const proof = {
      caseIdHash: "a".repeat(64),
      contentHash: "b".repeat(64),
      contentId: "local:evidence"
    };

    expect(caseProofMatches(proof, "b".repeat(64), "local:evidence")).toBe(true);
    expect(caseProofMatches(proof, "c".repeat(64), "local:evidence")).toBe(false);
    expect(caseProofMatches(proof, "b".repeat(64), "local:replacement")).toBe(false);
  });
});
