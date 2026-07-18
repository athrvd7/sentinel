import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readJsonResponse } from "@/lib/response";

export type StoredContent = {
  contentId: string;
  contentHash: string;
};

export type DevelopmentProofAnchor = {
  caseIdHash: string;
  contentHash: string;
  contentId: string;
};

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function dataDirectory(): string {
  return process.env.SENTINEL_DATA_DIR ?? path.join(process.cwd(), "data");
}

async function storeWithKubo(content: string): Promise<string> {
  const endpoint = process.env.IPFS_API_URL ?? "http://127.0.0.1:5001";
  const form = new FormData();
  form.append("file", new Blob([content], { type: "application/json" }), "encrypted-evidence.json");
  const response = await fetch(`${endpoint}/api/v0/add?pin=true`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(3_000)
  });

  if (!response.ok) {
    throw new Error("IPFS storage failed");
  }

  const result = await readJsonResponse<{ Hash?: string }>(response);

  if (!result.Hash) {
    throw new Error("IPFS returned no content identifier");
  }

  return result.Hash;
}

async function storeLocally(content: string, contentHash: string): Promise<string> {
  const directory = path.join(dataDirectory(), "content");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${contentHash}.json`), content, { encoding: "utf8", flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") {
      throw error;
    }
  });

  return `local:${contentHash}`;
}

export async function storeDevelopmentProofAnchor(
  proof: DevelopmentProofAnchor,
  directory = dataDirectory()
): Promise<string> {
  const serialized = JSON.stringify(proof);
  const proofHash = hashContent(serialized);
  const proofDirectory = path.join(directory, "proofs");
  await mkdir(proofDirectory, { recursive: true });
  await writeFile(path.join(proofDirectory, `${proofHash}.json`), serialized, { encoding: "utf8", flag: "wx" }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    }
  );

  return `dev:case:${proofHash}`;
}

export async function readDevelopmentProofAnchor(
  proofRef: string,
  directory = dataDirectory()
): Promise<DevelopmentProofAnchor | undefined> {
  const match = /^dev:case:([a-f0-9]{64})$/i.exec(proofRef);
  if (!match) return undefined;

  let serialized: string;
  try {
    serialized = await readFile(path.join(directory, "proofs", `${match[1]}.json`), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }

  if (hashContent(serialized) !== match[1].toLowerCase()) return undefined;

  try {
    const proof = JSON.parse(serialized) as DevelopmentProofAnchor;
    if (
      !/^[a-f0-9]{64}$/i.test(proof.caseIdHash) ||
      !/^[a-f0-9]{64}$/i.test(proof.contentHash) ||
      typeof proof.contentId !== "string" ||
      proof.contentId.length === 0
    ) {
      return undefined;
    }

    return proof;
  } catch {
    return undefined;
  }
}

export function allowsLocalStorageFallback(environment = process.env.NODE_ENV): boolean {
  return environment !== "production";
}

export async function storeCiphertext(content: string): Promise<StoredContent> {
  const contentHash = hashContent(content);

  try {
    return { contentId: await storeWithKubo(content), contentHash };
  } catch (error) {
    if (!allowsLocalStorageFallback()) {
      throw error;
    }

    // ponytail: development-only content addressing; start Kubo for pinned IPFS persistence.
    return { contentId: await storeLocally(content, contentHash), contentHash };
  }
}
