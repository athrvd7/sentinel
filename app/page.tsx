import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

const safeguards = [
  ["01", "No identity trail", "No account, email, phone number, wallet, analytics, or original image metadata."],
  ["02", "Encrypted before upload", "Your report and sanitised evidence are encrypted in your browser before storage."],
  ["03", "Proof that stays put", "Every evidence bundle and case event receives an integrity reference."],
  ["04", "Access with purpose", "Only the authorised investigator workspace can open an evidence case."],
];

const proofStages = [
  ["Browser", "Metadata removed before encryption"],
  ["Ciphertext", "Encrypted bundle stored by content address"],
  ["Proof", "Ciphertext hash anchored without disclosure"],
  ["Return", "A recovery code opens your case privately"],
];

const useCases = [
  ["Public corruption", "Preserve documents and a verifiable chain before evidence disappears."],
  ["Workplace misconduct", "Start a confidential record without joining an identity system."],
  ["Institutional failure", "Give authorised reviewers evidence they can prove has not changed."],
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <SiteHeader />
        <div className="landing-hero-copy">
          <h1>Speak safely.<br />Prove everything.</h1>
          <p>A private line for people who need to expose wrongdoing without exposing themselves.</p>
          <div className="hero-actions">
            <Link className="button dark" href="/submit">Submit evidence</Link>
            <Link className="text-link" href="/case">Check a case <span>↗</span></Link>
          </div>
        </div>
        <article className="hero-receipt" aria-label="Anonymous evidence protection">
          <span className="receipt-mark" aria-hidden="true">⌑</span>
          <strong>Encrypted before upload</strong>
          <p>Your identity does not enter the report.</p>
          <Link href="/case">Open a recovery code</Link>
        </article>
      </section>

      <section className="promise-strip">
        <div><strong>No identity required.</strong><p>Report what happened in a few considered steps.</p></div>
        <div className="promise-pagination" aria-hidden="true"><span>01</span><span>02</span><span className="active">03</span></div>
        <Link className="button compact" href="/submit">Start a report</Link>
      </section>

      <section className="safeguard-section" id="safeguards">
        <div className="section-heading"><p>Built to protect the person speaking up.</p><h2>Evidence stays private,<br />proof stays visible.</h2></div>
        <div className="safeguard-grid">
          {safeguards.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>

      <section className="evidence-network">
        <article className="network-node node-browser"><span>01</span><strong>Browser</strong><p>Clean source</p></article>
        <article className="network-node node-cipher"><span>02</span><strong>Ciphertext</strong><p>Encrypted bundle</p></article>
        <div className="network-copy"><p>From report to proof</p><h2>Evidence moves safely<br />without exposing you.</h2></div>
        <article className="network-node node-proof"><span>03</span><strong>Proof</strong><p>Integrity anchor</p></article>
        <article className="network-node node-case"><span>04</span><strong>Case</strong><p>Private return</p></article>
      </section>

      <section className="integrity-band">
        <div className="integrity-copy"><p>Sentinel Proof preserves the chain</p><h2>Keep the evidence.<br />Leave the identity behind.</h2><span>Encrypted bundle → content address → relay proof</span></div>
        <div className="integrity-visual" aria-hidden="true"><i /><i /><i /><b>verified</b></div>
        <dl className="integrity-metrics"><div><dt>0</dt><dd>identity fields</dd></div><div><dt>100%</dt><dd>browser encryption</dd></div><div><dt>1</dt><dd>recovery code</dd></div></dl>
      </section>

      <section className="security-section">
        <div className="security-copy"><p>Proof, without exposure</p><h2>Trust the evidence,<br />not the infrastructure.</h2><span>Image metadata is removed, evidence is sealed in the browser, and ciphertext integrity is anchored without revealing contents.</span><Link className="text-link" href="/submit">Submit safely <span>↗</span></Link></div>
        <div className="proof-stages">
          {proofStages.map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>

      <section className="use-case-section">
        <div className="section-heading centered"><h2>One private line<br />for the moments that matter.</h2></div>
        <div className="use-case-grid">
          {useCases.map(([title, copy], index) => <article key={title}><span>Case 0{index + 1}</span><h3>{title}</h3><p>{copy}</p><Link href="/submit">Start a report</Link></article>)}
        </div>
      </section>

      <section className="faq-section">
        <div><p>Questions? Answers.</p><h2>Before you submit.</h2></div>
        <dl><div><dt>Can I remain anonymous?</dt><dd>Yes. Sentinel Proof does not ask for identity information, and you do not need a wallet or account.</dd></div><div><dt>What happens to image metadata?</dt><dd>Supported images are re-encoded in your browser before encryption, removing embedded metadata from the submitted copy.</dd></div><div><dt>What if I lose my recovery code?</dt><dd>It cannot be restored. This prevents anyone—including us—from taking over your case.</dd></div></dl>
      </section>

      <section className="closing-cta"><Link className="button dark" href="/submit">Speak safely. Start here.</Link></section>

      <footer><div className="wordmark">sentinel<span>.</span></div><p>Private reporting. Verifiable evidence.</p><div><Link href="/submit">Submit evidence</Link><Link href="/case">Check a case</Link><Link href="/investigator">Investigator access</Link></div></footer>
    </main>
  );
}
