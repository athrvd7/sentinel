"use client";

import { FormEvent, useCallback, useState } from "react";
import { decryptEvidence } from "@/lib/client-evidence";
import { decryptText, encryptText, deriveAesKey, sha256, type EncryptedEnvelope } from "@/lib/crypto";
import { parseCaseCredential } from "@/lib/credential";
import { readJsonResponse } from "@/lib/response";

type CaseRecord = {
  caseId: string;
  envelope: string;
  contentId: string;
  status: string;
  createdAt: string;
};

type Message = { id: string; author: "whistleblower" | "investigator"; envelope: string; createdAt: string };
type Integrity = { proofRef: string; evidenceHash: string };
type OpenCase = { credential: ReturnType<typeof parseCaseCredential>; caseRecord: CaseRecord; integrity: Integrity; report: string; attachmentCount: number; messages: Array<Message & { text: string }> };

function labelForStatus(status: string): string {
  return status.replaceAll("_", " ");
}

export function CaseAccess() {
  const [openCase, setOpenCase] = useState<OpenCase>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const loadCase = useCallback(async (credentialValue: string) => {
    const credential = parseCaseCredential(credentialValue);
    const response = await fetch(`/api/cases/${credential.caseId}`, {
      headers: { authorization: `Case ${credential.secret}` },
      cache: "no-store"
    });
    const result = await readJsonResponse<{ case?: CaseRecord; integrity?: Integrity; messages?: Message[]; error?: string }>(response);

    if (!response.ok || !result.case || !result.integrity || !result.messages) {
      throw new Error(result.error ?? "Case not found");
    }

    if ((await sha256(result.case.envelope)) !== result.integrity.evidenceHash) {
      throw new Error("Integrity check failed. This evidence will not be opened.");
    }

    const evidence = await decryptEvidence(JSON.parse(result.case.envelope) as EncryptedEnvelope, credential.secret);
    const key = await deriveAesKey(credential.secret);
    const messages = await Promise.all(
      result.messages.map(async (entry) => ({
        ...entry,
        text: await decryptText(JSON.parse(entry.envelope) as EncryptedEnvelope, key)
      }))
    );

    setOpenCase({ credential, caseRecord: result.case, integrity: result.integrity, report: evidence.report, attachmentCount: evidence.attachments.length, messages });
  }, []);

  async function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const credential = String(new FormData(event.currentTarget).get("credential") ?? "");
    setPending(true);
    setError(undefined);

    try {
      await loadCase(credential);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Case not found");
    } finally {
      setPending(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openCase || !message.trim()) return;

    setPending(true);
    setError(undefined);
    try {
      const envelope = await encryptText(message.trim(), await deriveAesKey(openCase.credential.secret));
      const response = await fetch(`/api/cases/${openCase.caseRecord.caseId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Case ${openCase.credential.secret}` },
        body: JSON.stringify({ envelope: JSON.stringify(envelope) })
      });

      if (!response.ok) throw new Error("Message could not be sent.");
      setMessage("");
      await loadCase(`SP-${openCase.credential.caseId}.${openCase.credential.secret}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Message could not be sent.");
    } finally {
      setPending(false);
    }
  }

  if (!openCase) {
    return (
      <form className="access-form" onSubmit={open}>
        <p className="eyebrow">Anonymous recovery</p>
        <h1>Return without revealing who you are.</h1>
        <label>
          <span>Recovery code</span>
          <input name="credential" required placeholder="SP-…" autoComplete="off" spellCheck={false} />
        </label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button primary" disabled={pending} type="submit">{pending ? "Opening secure case…" : "Open my case"}</button>
        <p className="form-note">Use the recovery code shown after submission. A lost code cannot be restored.</p>
      </form>
    );
  }

  return (
    <section className="case-workspace">
      <div className="case-summary">
        <div><p className="eyebrow">Case {openCase.caseRecord.caseId}</p><h1>{labelForStatus(openCase.caseRecord.status)}</h1></div>
        <span className={`status status-${openCase.caseRecord.status}`}>{labelForStatus(openCase.caseRecord.status)}</span>
      </div>
      <div className="integrity-banner"><span>✓</span> Evidence integrity verified against {openCase.integrity.proofRef}</div>
      <article className="decrypted-report"><p className="eyebrow">Your encrypted report</p><p>{openCase.report}</p><small>{openCase.attachmentCount} sanitized supporting image{openCase.attachmentCount === 1 ? "" : "s"}</small></article>
      <section className="thread" aria-label="Case messages">
        <div className="thread-head"><p className="eyebrow">Anonymous thread</p><p>Messages remain encrypted until opened in this browser.</p></div>
        {openCase.messages.length ? openCase.messages.map((entry) => <article className={`message ${entry.author}`} key={entry.id}><span>{entry.author === "whistleblower" ? "You" : "Investigator"}</span><p>{entry.text}</p></article>) : <p className="empty-thread">No messages yet. An investigator can reply here without knowing your identity.</p>}
        <form onSubmit={sendMessage} className="message-form"><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="Write an anonymous reply…" /><button className="button secondary" disabled={pending} type="submit">Send encrypted reply</button></form>
      </section>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}
