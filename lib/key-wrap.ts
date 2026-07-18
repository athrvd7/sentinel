import { base64UrlToBytes, bytesToBase64Url } from "@/lib/encoding";

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function wrapCaseSecret(secret: string, publicKey: JsonWebKey): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "jwk",
    publicKey,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
  const wrapped = await globalThis.crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, arrayBuffer(base64UrlToBytes(secret)));

  return bytesToBase64Url(new Uint8Array(wrapped));
}
