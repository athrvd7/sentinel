import { constants, createPublicKey, generateKeyPairSync, privateDecrypt } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type KeyRecord = {
  privateKey: string;
  publicKey: JsonWebKey;
};

export type InvestigatorKeyStore = {
  publicJwk: () => JsonWebKey;
  unwrap: (wrappedCaseKey: string) => string;
};

function loadOrCreateKeyRecord(keyPath: string): KeyRecord {
  try {
    return JSON.parse(readFileSync(keyPath, "utf8")) as KeyRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  const record: KeyRecord = {
    privateKey,
    publicKey: createPublicKey(publicKey).export({ format: "jwk" }) as JsonWebKey
  };

  writeFileSync(keyPath, JSON.stringify(record), { encoding: "utf8", mode: 0o600 });
  return record;
}

export function createInvestigatorKeyStore(directory = path.join(process.cwd(), "data")): InvestigatorKeyStore {
  mkdirSync(directory, { recursive: true });
  const record = loadOrCreateKeyRecord(path.join(directory, "investigator-key.json"));

  return {
    publicJwk: () => record.publicKey,
    unwrap: (wrappedCaseKey) =>
      privateDecrypt(
        { key: record.privateKey, oaepHash: "sha256", padding: constants.RSA_PKCS1_OAEP_PADDING },
        Buffer.from(wrappedCaseKey, "base64url")
      ).toString("base64url")
  };
}

let sharedKeyStore: InvestigatorKeyStore | undefined;

export function investigatorKeyStore(): InvestigatorKeyStore {
  sharedKeyStore ??= createInvestigatorKeyStore();
  return sharedKeyStore;
}
