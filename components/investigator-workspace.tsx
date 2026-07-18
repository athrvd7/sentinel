"use client";

import { FormEvent, useState } from "react";
import { decryptEvidence } from "@/lib/client-evidence";
import { decryptText, deriveAesKey, encryptText, sha256, type EncryptedEnvelope } from "@/lib/crypto";
import { readJsonResponse } from "@/lib/response";

type CaseSummary = { caseId: string; status: "submitted" | "under_review" | "resolved"; createdAt: string; proofRef: string };
type CaseDetail = {
  case: { caseId: string; envelope: string; status: "submitted" | "under_review" | "resolved"; proofRef: string };
  integrity: { proofRef: string; evidenceHash: string };
  caseSecret: string;
  messages: Array<{ id: string; author: "whistleblower" | "investigator"; envelope: string; createdAt: string }>;
};
type DecryptedCase = Omit<CaseDetail, "messages"> & {
  report: string;
  attachmentCount: number;
  messages: Array<CaseDetail["messages"][number] & { text: string }>;
};

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export function InvestigatorWorkspace() {
  const [signedIn, setSignedIn] = useState(false);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selected, setSelected] = useState<DecryptedCase>();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function refreshCases(): Promise<CaseSummary[]> {
    const response = await fetch("/api/investigator/cases", { cache: "no-store" });
    const result = await readJsonResponse<{ cases?: CaseSummary[]; error?: string }>(response);

    if (!response.ok || !result.cases) throw new Error(result.error ?? "Unable to load cases");
    setCases(result.cases);
    return result.cases;
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/investigator/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!response.ok) throw new Error("Invalid investigator credentials");
      setSignedIn(true);
      await refreshCases();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in");
    } finally {
      setPending(false);
    }
  }

  async function selectCase(caseId: string) {
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/investigator/cases/${caseId}`, { cache: "no-store" });
      const result = await readJsonResponse<Partial<CaseDetail> & { error?: string }>(response);
      if (!response.ok || !result.case || !result.integrity || !result.caseSecret || !result.messages) throw new Error(result.error ?? "Unable to open case");
      if ((await sha256(result.case.envelope)) !== result.integrity.evidenceHash) throw new Error("Integrity check failed. Evidence remains sealed.");

      const evidence = await decryptEvidence(JSON.parse(result.case.envelope) as EncryptedEnvelope, result.caseSecret);
      const key = await deriveAesKey(result.caseSecret);
      const messages = await Promise.all(result.messages.map(async (entry) => ({ ...entry, text: await decryptText(JSON.parse(entry.envelope) as EncryptedEnvelope, key) })));
      setSelected({ case: result.case, integrity: result.integrity, caseSecret: result.caseSecret, messages, report: evidence.report, attachmentCount: evidence.attachments.length });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open case");
    } finally {
      setPending(false);
    }
  }

  async function updateStatus(status: CaseSummary["status"]) {
    if (!selected) return;
    setPending(true);
    try {
      const response = await fetch(`/api/investigator/cases/${selected.case.caseId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error("Status update failed");
      await refreshCases();
      await selectCase(selected.case.caseId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status update failed");
    } finally {
      setPending(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !message.trim()) return;
    setPending(true);
    try {
      const envelope = await encryptText(message.trim(), await deriveAesKey(selected.caseSecret));
      const response = await fetch(`/api/investigator/cases/${selected.case.caseId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ envelope: JSON.stringify(envelope) })
      });
      if (!response.ok) throw new Error("Message could not be sent");
      setMessage("");
      await selectCase(selected.case.caseId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Message could not be sent");
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    await fetch("/api/investigator/logout", { method: "POST" });
    setSignedIn(false);
    setCases([]);
    setSelected(undefined);
  }

  if (!signedIn) {
    return (
      <form className="access-form investigator-login" onSubmit={login}>
        <p className="eyebrow">Authorized access only</p>
        <h1>Review without breaking the chain of trust.</h1>
        <label><span>Investigator password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button primary" disabled={pending} type="submit">{pending ? "Verifying…" : "Open investigator workspace"}</button>
        <p className="form-note">The local demo password is available only when <code>SENTINEL_DEMO_MODE=true</code> is configured.</p>
      </form>
    );
  }

  return (
    <section className="investigator-workspace">
      <aside className="case-queue">
        <div className="queue-header"><div><p className="eyebrow">Investigator console</p><h1>Evidence queue</h1></div><button className="text-button" onClick={logout}>Sign out</button></div>
        {cases.length ? cases.map((entry) => <button className={`case-row ${selected?.case.caseId === entry.caseId ? "active" : ""}`} key={entry.caseId} onClick={() => selectCase(entry.caseId)}><span className={`status status-${entry.status}`}>{statusLabel(entry.status)}</span><strong>{entry.caseId}</strong><small>{entry.proofRef}</small></button>) : <p className="empty-thread">No cases have been submitted yet.</p>}
      </aside>
      <main className="investigation-panel">
        {selected ? <>
          <div className="case-summary"><div><p className="eyebrow">Verified case</p><h1>{selected.case.caseId}</h1></div><span className={`status status-${selected.case.status}`}>{statusLabel(selected.case.status)}</span></div>
          <div className="integrity-banner"><span>✓</span> SHA-256 ciphertext proof matches {selected.integrity.proofRef}</div>
          <article className="decrypted-report"><p className="eyebrow">Decrypted report</p><p>{selected.report}</p><small>{selected.attachmentCount} sanitized supporting image{selected.attachmentCount === 1 ? "" : "s"}</small></article>
          <div className="status-actions"><span>Case status</span>{(["submitted", "under_review", "resolved"] as const).map((status) => <button className={selected.case.status === status ? "selected" : ""} disabled={pending} key={status} onClick={() => updateStatus(status)}>{statusLabel(status)}</button>)}</div>
          <section className="thread"><div className="thread-head"><p className="eyebrow">Encrypted conversation</p><p>Messages are decrypted only in this browser view.</p></div>{selected.messages.length ? selected.messages.map((entry) => <article className={`message ${entry.author}`} key={entry.id}><span>{entry.author === "whistleblower" ? "Whistleblower" : "You"}</span><p>{entry.text}</p></article>) : <p className="empty-thread">No messages yet.</p>}<form className="message-form" onSubmit={sendMessage}><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="Ask an anonymous follow-up question…" /><button className="button secondary" disabled={pending} type="submit">Send encrypted message</button></form></section>
        </> : <div className="empty-investigation"><p className="eyebrow">Waiting for selection</p><h1>Select a case to verify its proof.</h1><p>The evidence queue never previews plaintext. Open a case to verify and decrypt it locally.</p></div>}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </main>
    </section>
  );
}
