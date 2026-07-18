"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createEncryptedEvidence } from "@/lib/client-evidence";
import { createCaseCredential, credentialVerifier } from "@/lib/credential";
import { wrapCaseSecret } from "@/lib/key-wrap";
import { readJsonResponse } from "@/lib/response";

type Receipt = { credential: string; proofRef: string };

export function SubmitForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [receipt, setReceipt] = useState<Receipt>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const report = String(form.get("report") ?? "");

    if (report.trim().length < 20) {
      setError("Please describe what happened in at least 20 characters.");
      return;
    }

    setPending(true);
    setError(undefined);

    try {
      const credential = createCaseCredential();
      const [publicKeyResponse, envelope] = await Promise.all([
        fetch("/api/investigator/public-key", { cache: "no-store" }),
        createEncryptedEvidence(report, files, credential.secret)
      ]);

      if (!publicKeyResponse.ok) {
        throw new Error("Secure submission setup failed. Please try again.");
      }

      const { publicKey } = await readJsonResponse<{ publicKey: JsonWebKey }>(publicKeyResponse);
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseId: credential.caseId,
          secretVerifier: await credentialVerifier(credential.secret),
          envelope: JSON.stringify(envelope),
          wrappedCaseKey: await wrapCaseSecret(credential.secret, publicKey)
        })
      });
      const result = await readJsonResponse<{ proofRef?: string; error?: string }>(response);

      if (!response.ok || !result.proofRef) {
        throw new Error(result.error ?? "Secure submission failed. Please try again.");
      }

      setReceipt({ credential: credential.display, proofRef: result.proofRef });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Secure submission failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (receipt) {
    return (
      <section className="receipt-card" aria-live="polite">
        <p className="eyebrow">Case created</p>
        <h1>Keep this recovery code somewhere safe.</h1>
        <p>It is the only way to reopen your anonymous case. We cannot restore it for you.</p>
        <code className="recovery-code">{receipt.credential}</code>
        <p className="proof-line">Proof reference · {receipt.proofRef}</p>
        <Link className="button primary" href="/case">Check case status</Link>
      </section>
    );
  }

  return (
    <form className="submission-form" onSubmit={submit}>
      <div className="form-intro">
        <p className="eyebrow">Anonymous by design</p>
        <h1>Say what happened. Keep your identity out of it.</h1>
        <p>Your evidence is cleaned in this browser, encrypted before upload, and sealed with an integrity proof.</p>
      </div>
      <label>
        <span>What should an investigator know?</span>
        <textarea name="report" required minLength={20} rows={10} placeholder="Describe the incident, where it happened, and why it matters. Do not include your name or contact details." />
      </label>
      <label className="upload-field">
        <span>Supporting images <small>JPEG or PNG · up to 5 files · 10 MB each</small></span>
        <input
          accept="image/jpeg,image/png"
          multiple
          type="file"
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        />
        <strong>{files.length ? `${files.length} image${files.length === 1 ? "" : "s"} selected` : "Choose images"}</strong>
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="button primary" disabled={pending} type="submit">
        {pending ? "Encrypting and sealing…" : "Encrypt & submit evidence"}
      </button>
      <p className="form-note">No account. No email. No wallet. Your original image metadata is removed before upload.</p>
    </form>
  );
}
