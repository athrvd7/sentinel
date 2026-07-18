import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import { readDevelopmentProofAnchor, storeDevelopmentProofAnchor, type DevelopmentProofAnchor } from "@/lib/content-store";

const registryAbi = [
  {
    type: "function",
    name: "registerCase",
    stateMutability: "nonpayable",
    inputs: [
      { name: "caseId", type: "bytes32" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "contentId", type: "string" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "appendMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "caseId", type: "bytes32" },
      { name: "messageHash", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "updateStatus",
    stateMutability: "nonpayable",
    inputs: [
      { name: "caseId", type: "bytes32" },
      { name: "status", type: "uint8" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "cases",
    stateMutability: "view",
    inputs: [{ name: "caseId", type: "bytes32" }],
    outputs: [
      { name: "evidenceHash", type: "bytes32" },
      { name: "contentId", type: "string" },
      { name: "status", type: "uint8" },
      { name: "registered", type: "bool" }
    ]
  }
] as const;

type ChainStatus = "submitted" | "under_review" | "resolved";

function hexHash(value: string): `0x${string}` {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("Expected a SHA-256 hash");
  }

  return `0x${value}`;
}

function configuredClient() {
  const address = process.env.REGISTRY_ADDRESS;
  const privateKey = process.env.RELAY_PRIVATE_KEY;

  if (!/^0x[a-f0-9]{40}$/i.test(address ?? "") || !/^0x[a-f0-9]{64}$/i.test(privateKey ?? "")) {
    return undefined;
  }

  const transport = http(process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545");

  return {
    address: address as `0x${string}`,
    client: createWalletClient({
      account: privateKeyToAccount(privateKey as `0x${string}`),
      chain: anvil,
      transport
    }),
    publicClient: createPublicClient({ chain: anvil, transport })
  };
}

function allowsDevelopmentProofs(environment = process.env.NODE_ENV): boolean {
  return environment !== "production";
}

function unavailableRelay(): never {
  throw new Error("Blockchain relay is not configured");
}

async function confirmedProofRef(
  connection: NonNullable<ReturnType<typeof configuredClient>>,
  transaction: Promise<`0x${string}`>
): Promise<string> {
  const proofRef = await transaction;
  const receipt = await connection.publicClient.waitForTransactionReceipt({ hash: proofRef });

  if (receipt.status !== "success") {
    throw new Error("Blockchain proof transaction failed");
  }

  return proofRef;
}

export async function anchorCase(caseIdHash: string, evidenceHash: string, contentId: string): Promise<string> {
  const connection = configuredClient();

  if (!connection) {
    if (!allowsDevelopmentProofs()) unavailableRelay();

    // ponytail: development-only proof record; configure Anvil for immutable production proofs.
    return storeDevelopmentProofAnchor({ caseIdHash, contentHash: evidenceHash, contentId });
  }

  return confirmedProofRef(
    connection,
    connection.client.writeContract({
      address: connection.address,
      abi: registryAbi,
      functionName: "registerCase",
      args: [hexHash(caseIdHash), hexHash(evidenceHash), contentId]
    })
  );
}

export async function anchorMessage(caseIdHash: string, messageHash: string): Promise<string> {
  const connection = configuredClient();

  if (!connection) {
    if (!allowsDevelopmentProofs()) unavailableRelay();
    return `dev:${messageHash}`;
  }

  return confirmedProofRef(
    connection,
    connection.client.writeContract({
      address: connection.address,
      abi: registryAbi,
      functionName: "appendMessage",
      args: [hexHash(caseIdHash), hexHash(messageHash)]
    })
  );
}

export async function anchorStatus(caseIdHash: string, status: ChainStatus): Promise<string> {
  const connection = configuredClient();
  const statusValue = { submitted: 0, under_review: 1, resolved: 2 }[status];

  if (!connection) {
    if (!allowsDevelopmentProofs()) unavailableRelay();
    return `dev:status:${caseIdHash}`;
  }

  return confirmedProofRef(
    connection,
    connection.client.writeContract({
      address: connection.address,
      abi: registryAbi,
      functionName: "updateStatus",
      args: [hexHash(caseIdHash), statusValue]
    })
  );
}

export type AnchoredCaseProof = DevelopmentProofAnchor;

export function caseProofMatches(
  proof: AnchoredCaseProof | undefined,
  contentHash: string,
  contentId: string
): boolean {
  return Boolean(proof && proof.contentHash === contentHash && proof.contentId === contentId);
}

export async function readAnchoredCaseProof(
  caseIdHash: string,
  proofRef: string
): Promise<AnchoredCaseProof | undefined> {
  const connection = configuredClient();

  if (!connection) {
    if (!allowsDevelopmentProofs()) unavailableRelay();
    const proof = await readDevelopmentProofAnchor(proofRef);

    return proof?.caseIdHash === caseIdHash ? proof : undefined;
  }

  const [evidenceHash, contentId, , registered] = (await connection.publicClient.readContract({
    address: connection.address,
    abi: registryAbi,
    functionName: "cases",
    args: [hexHash(caseIdHash)]
  })) as readonly [`0x${string}`, string, number, boolean];

  if (!registered) return undefined;

  return { caseIdHash, contentHash: evidenceHash.slice(2).toLowerCase(), contentId };
}
