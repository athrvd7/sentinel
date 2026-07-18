import { describe, expect, test } from "vitest";
import {
  decryptBytes,
  decryptText,
  deriveAesKey,
  encryptBytes,
  encryptText,
  generateAesKey,
  parseEncryptedEnvelope,
  sha256
} from "@/lib/crypto";

describe("encrypted evidence envelopes", () => {
  test("round-trips plaintext without exposing it in the envelope", async () => {
    const key = await generateAesKey();
    const envelope = await encryptText("A confidential report", key);

    expect(envelope.ciphertext).not.toContain("confidential");
    await expect(decryptText(envelope, key)).resolves.toBe("A confidential report");
  });

  test("rejects a modified ciphertext", async () => {
    const key = await generateAesKey();
    const envelope = await encryptText("Evidence", key);
    const tampered = { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -2)}aa` };

    await expect(decryptText(tampered, key)).rejects.toThrow();
  });

  test("produces a stable SHA-256 evidence hash", async () => {
    await expect(sha256("evidence")).resolves.toBe(
      "ee8250fb76e094b34b471f13a73dbbe51d1ae142e9df59d7c0d31ec20f0a0a8e"
    );
  });

  test("derives the same case key from a recovery secret", async () => {
    const firstKey = await deriveAesKey("case-secret");
    const secondKey = await deriveAesKey("case-secret");
    const encrypted = await encryptText("recovered evidence", firstKey);

    await expect(decryptText(encrypted, secondKey)).resolves.toBe("recovered evidence");
  });

  test("round-trips encrypted image bytes", async () => {
    const key = await generateAesKey();
    const original = new Uint8Array([137, 80, 78, 71]);
    const envelope = await encryptBytes(original, key);

    await expect(decryptBytes(envelope, key)).resolves.toEqual(original);
  });

  test("accepts only complete AES-GCM JSON envelopes", () => {
    const serialized = JSON.stringify({
      ciphertext: "AA",
      iv: "AAECAwQFBgcICQoL",
      algorithm: "AES-GCM"
    });

    expect(parseEncryptedEnvelope(serialized)).toEqual(JSON.parse(serialized));
    expect(parseEncryptedEnvelope("plaintext evidence")).toBeUndefined();
    expect(parseEncryptedEnvelope(JSON.stringify({ ciphertext: "AA", iv: "not base64", algorithm: "AES-GCM" }))).toBeUndefined();
    expect(parseEncryptedEnvelope(JSON.stringify({ ciphertext: "", iv: "AAECAwQFBgcICQoL", algorithm: "AES-GCM" }))).toBeUndefined();
    expect(parseEncryptedEnvelope(JSON.stringify({ ciphertext: "AA", iv: "AAECAwQFBgcICQoL", algorithm: "AES-GCM", note: "plaintext" }))).toBeUndefined();
  });
});
