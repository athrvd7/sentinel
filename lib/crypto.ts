import { base64UrlToBytes, bytesToBase64Url, bytesToHex } from "@/lib/encoding";

export type EncryptedEnvelope = {
  ciphertext: string;
  iv: string;
  algorithm: "AES-GCM";
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function webCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable");
  }

  return globalThis.crypto;
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function parseEncryptedEnvelope(value: unknown): EncryptedEnvelope | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(value);
  } catch {
    return undefined;
  }

  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return undefined;
  }

  const candidate = envelope as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (
    keys.length !== 3 ||
    !keys.every((key) => key === "ciphertext" || key === "iv" || key === "algorithm") ||
    typeof candidate.ciphertext !== "string" ||
    typeof candidate.iv !== "string" ||
    candidate.algorithm !== "AES-GCM" ||
    !/^[A-Za-z0-9_-]+$/.test(candidate.ciphertext) ||
    !/^[A-Za-z0-9_-]+$/.test(candidate.iv)
  ) {
    return undefined;
  }

  try {
    if (base64UrlToBytes(candidate.iv).byteLength !== 12) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  return { ciphertext: candidate.ciphertext, iv: candidate.iv, algorithm: "AES-GCM" };
}

export async function generateAesKey(): Promise<CryptoKey> {
  return webCrypto().subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const material = await webCrypto().subtle.digest("SHA-256", textEncoder.encode(secret));

  return webCrypto().subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptBytes(plaintext: Uint8Array, key: CryptoKey): Promise<EncryptedEnvelope> {
  const iv = webCrypto().getRandomValues(new Uint8Array(12));
  const ciphertext = await webCrypto().subtle.encrypt({ name: "AES-GCM", iv }, key, arrayBuffer(plaintext));

  return {
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    iv: bytesToBase64Url(iv),
    algorithm: "AES-GCM"
  };
}

export async function decryptBytes(envelope: EncryptedEnvelope, key: CryptoKey): Promise<Uint8Array> {
  if (envelope.algorithm !== "AES-GCM") {
    throw new Error("Unsupported encryption algorithm");
  }

  const plaintext = await webCrypto().subtle.decrypt(
    { name: "AES-GCM", iv: arrayBuffer(base64UrlToBytes(envelope.iv)) },
    key,
    arrayBuffer(base64UrlToBytes(envelope.ciphertext))
  );

  return new Uint8Array(plaintext);
}

export function encryptText(plaintext: string, key: CryptoKey): Promise<EncryptedEnvelope> {
  return encryptBytes(textEncoder.encode(plaintext), key);
}

export async function decryptText(envelope: EncryptedEnvelope, key: CryptoKey): Promise<string> {
  return textDecoder.decode(await decryptBytes(envelope, key));
}

export async function sha256(value: string | Uint8Array): Promise<string> {
  const data = typeof value === "string" ? textEncoder.encode(value) : value;
  const digest = await webCrypto().subtle.digest("SHA-256", arrayBuffer(data));

  return bytesToHex(new Uint8Array(digest));
}
