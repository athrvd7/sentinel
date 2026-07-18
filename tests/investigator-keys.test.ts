import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createInvestigatorKeyStore } from "@/lib/investigator-keys";
import { wrapCaseSecret } from "@/lib/key-wrap";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("investigator case-key exchange", () => {
  test("wraps a case secret with the public key and unwraps it for the investigator", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "sentinel-keys-"));
    temporaryDirectories.push(directory);
    const keyStore = createInvestigatorKeyStore(directory);
    const secret = "8tA__MRBlw4q9r81gPk0Z6mJf-lSFnYqCe1u7Wz5G8A";

    const wrapped = await wrapCaseSecret(secret, keyStore.publicJwk());

    expect(wrapped).not.toContain(secret);
    expect(keyStore.unwrap(wrapped)).toBe(secret);
  });
});
