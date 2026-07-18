import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type CaseStatus = "submitted" | "under_review" | "resolved";
export type MessageAuthor = "whistleblower" | "investigator";

export type PersistedCase = {
  caseId: string;
  secretVerifier: string;
  envelope: string;
  evidenceHash: string;
  contentId: string;
  proofRef: string;
  wrappedCaseKey: string;
  status: CaseStatus;
  statusProofRef: string | null;
  createdAt: string;
};

export type PersistedMessage = {
  id: string;
  caseId: string;
  author: MessageAuthor;
  envelope: string;
  contentHash: string;
  proofRef: string;
  createdAt: string;
};

export type CreateCaseInput = Omit<PersistedCase, "status" | "statusProofRef" | "createdAt">;
export type CreateMessageInput = Omit<PersistedMessage, "createdAt">;

export class CaseRepository {
  private readonly database: DatabaseSync;

  constructor(databasePath = path.join(process.cwd(), "data", "sentinel.db")) {
    mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS cases (
        case_id TEXT PRIMARY KEY,
        secret_verifier TEXT NOT NULL,
        envelope TEXT NOT NULL,
        evidence_hash TEXT NOT NULL,
        content_id TEXT NOT NULL,
        proof_ref TEXT NOT NULL,
        wrapped_case_key TEXT NOT NULL,
        status TEXT NOT NULL,
        status_proof_ref TEXT,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL REFERENCES cases(case_id),
        author TEXT NOT NULL,
        envelope TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        proof_ref TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
    `);

    const columns = this.database.prepare("PRAGMA table_info(cases)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "status_proof_ref")) {
      this.database.exec("ALTER TABLE cases ADD COLUMN status_proof_ref TEXT");
    }
  }

  create(input: CreateCaseInput): PersistedCase {
    const createdAt = new Date().toISOString();
    this.database
      .prepare(
        `INSERT INTO cases (
          case_id, secret_verifier, envelope, evidence_hash, content_id, proof_ref, wrapped_case_key, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.caseId,
        input.secretVerifier,
        input.envelope,
        input.evidenceHash,
        input.contentId,
        input.proofRef,
        input.wrappedCaseKey,
        "submitted",
        createdAt
      );

    return { ...input, status: "submitted", statusProofRef: null, createdAt };
  }

  findById(caseId: string): PersistedCase | undefined {
    return this.database
      .prepare(
        `SELECT case_id AS caseId, secret_verifier AS secretVerifier, envelope, evidence_hash AS evidenceHash,
          content_id AS contentId, proof_ref AS proofRef, wrapped_case_key AS wrappedCaseKey, status,
          status_proof_ref AS statusProofRef,
          created_at AS createdAt FROM cases WHERE case_id = ?`
      )
      .get(caseId) as PersistedCase | undefined;
  }

  findForSecret(caseId: string, secretVerifier: string): PersistedCase | undefined {
    return this.database
      .prepare(
        `SELECT case_id AS caseId, secret_verifier AS secretVerifier, envelope, evidence_hash AS evidenceHash,
          content_id AS contentId, proof_ref AS proofRef, wrapped_case_key AS wrappedCaseKey, status,
          status_proof_ref AS statusProofRef,
          created_at AS createdAt FROM cases WHERE case_id = ? AND secret_verifier = ?`
      )
      .get(caseId, secretVerifier) as PersistedCase | undefined;
  }

  list(): PersistedCase[] {
    return this.database
      .prepare(
        `SELECT case_id AS caseId, secret_verifier AS secretVerifier, envelope, evidence_hash AS evidenceHash,
          content_id AS contentId, proof_ref AS proofRef, wrapped_case_key AS wrappedCaseKey, status,
          status_proof_ref AS statusProofRef,
          created_at AS createdAt FROM cases ORDER BY created_at DESC`
      )
      .all() as PersistedCase[];
  }

  updateStatus(caseId: string, status: CaseStatus, proofRef: string): void {
    const result = this.database.prepare("UPDATE cases SET status = ?, status_proof_ref = ? WHERE case_id = ?").run(status, proofRef, caseId);

    if (result.changes !== 1) {
      throw new Error("Case not found");
    }
  }

  addMessage(input: CreateMessageInput): PersistedMessage {
    const createdAt = new Date().toISOString();
    this.database
      .prepare(
        `INSERT INTO messages (id, case_id, author, envelope, content_hash, proof_ref, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(input.id, input.caseId, input.author, input.envelope, input.contentHash, input.proofRef, createdAt);

    return { ...input, createdAt };
  }

  messagesFor(caseId: string): PersistedMessage[] {
    return this.database
      .prepare(
        `SELECT id, case_id AS caseId, author, envelope, content_hash AS contentHash, proof_ref AS proofRef,
          created_at AS createdAt FROM messages WHERE case_id = ? ORDER BY created_at ASC`
      )
      .all(caseId) as PersistedMessage[];
  }
}
