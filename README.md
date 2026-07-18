# Sentinel Proof

<div align="center">
  <h1>Speak safely. Prove everything.</h1>

  <p>
    Anonymous evidence submission with encrypted case recovery and verifiable integrity proofs.
  </p>

  <p>
    <a href="#getting-started">Get Started</a> ·
    <a href="#how-it-works">How It Works</a> ·
    <a href="#scripts">Scripts</a>
  </p>
</div>

---

## The Why

People who report wrongdoing should not have to trade their identity for a way to preserve evidence or follow up on a case.

**Sentinel Proof separates private evidence from public proof.** A whistleblower submits a report without an account, wallet, email address, or identifying profile. The browser removes supported image metadata and encrypts the report before upload. The server stores ciphertext, hashes, and opaque case references; an authorized investigator can access the case through a protected workspace.

Evidence integrity is anchored through a relay-controlled Solidity registry. The chain records hashes, content references, status changes, and message hashes without receiving plaintext reports or case secrets.

> Sentinel Proof is a local-first MVP. Its default development fallbacks are not a production deployment, and the project should not be used for real sensitive reports without a security review and production-grade infrastructure.

## How It Works

1. **Create a recovery credential** — The browser generates an opaque case ID and secret. The full recovery code is shown only to the whistleblower.
2. **Prepare evidence locally** — Supported JPEG and PNG files are re-encoded in the browser before encryption. Unsupported files are rejected.
3. **Encrypt before upload** — Report text and sanitized evidence are sealed with AES-GCM. The server receives encrypted envelopes rather than plaintext content.
4. **Store ciphertext and proof references** — Encrypted content is sent to Kubo/IPFS when configured, or to a development-only local content-addressed fallback. SHA-256 hashes identify the stored ciphertext.
5. **Anchor integrity** — The relay records the case hash, evidence hash, and content identifier in `EvidenceRegistry`. The relay also anchors messages and status changes.
6. **Return privately** — The whistleblower uses the recovery code to reopen the case. A hash mismatch blocks decryption and is surfaced as an integrity failure.
7. **Review and reply** — The preconfigured investigator authenticates into the workspace, verifies evidence integrity, updates case status, and sends encrypted replies.

## What It Does

- **Anonymous submission:** No names, email addresses, locations, IP addresses, user-agent strings, analytics identifiers, or wallet addresses are collected from whistleblowers.
- **Browser-side encryption:** Report text and evidence are encrypted before they cross the upload boundary using native Web Crypto AES-GCM.
- **Image sanitization:** JPEG and PNG uploads are re-encoded before encryption so the submitted copy does not retain original image metadata.
- **Recovery-code access:** The whistleblower returns with a case credential instead of an account. Losing the code means the case cannot be recovered.
- **Encrypted case messages:** Whistleblower and investigator messages are stored as encrypted envelopes and integrity-protected separately.
- **Investigator key wrapping:** A locally persisted investigator RSA key pair wraps the case key so the investigator workspace can decrypt authorized cases.
- **Integrity verification:** Evidence and messages are checked against their stored hashes and proof references before decryption.
- **Relay-controlled blockchain writes:** Whistleblowers never use a wallet. The configured server service wallet relays registry transactions.
- **Single-organization MVP:** The app supports one organization and one preconfigured investigator rather than multi-agency administration.

## System Architecture

```text
┌────────────────────────┐
│ Browser                │
│ report + image cleanup │
│ AES-GCM encryption     │
└───────────┬────────────┘
            │ encrypted envelopes only
            ▼
┌────────────────────────┐       ┌─────────────────────────┐
│ Next.js application    │──────▶│ SQLite case repository  │
│ API routes + auth      │       │ ciphertext metadata      │
└───────────┬────────────┘       └─────────────────────────┘
            │ encrypted content
            ▼
┌────────────────────────┐       ┌─────────────────────────┐
│ Kubo / IPFS            │       │ Anvil + EvidenceRegistry │
│ pinned ciphertext      │◀──────│ relay proof transactions  │
└────────────────────────┘       └─────────────────────────┘
```

The SQLite repository stores case metadata, encrypted envelopes, hashes, content identifiers, proof references, and case status. It does not store plaintext reports, images, messages, case secrets, or image metadata.

In development, Kubo and the blockchain relay may be omitted: encrypted content can use a local content-addressed fallback, and proof records can use a development-only local reference. Production mode rejects those fallbacks when the required services are not configured.

## Tech Stack

- **Frontend and server:** Next.js 16, React 19, TypeScript
- **Browser cryptography:** Web Crypto API with AES-GCM and SHA-256
- **Server cryptography:** Node.js `crypto` for hashing, constant-time checks, RSA-OAEP key wrapping, and investigator sessions
- **Persistence:** Node.js `node:sqlite`
- **Content storage:** Kubo/IPFS, with a development-only local fallback
- **Blockchain client:** `viem`
- **Smart contract:** Solidity `^0.8.28`
- **Local EVM:** Foundry/Anvil
- **Testing:** Vitest and Foundry

## Getting Started

### Prerequisites

- Node.js 22 or newer
- npm
- Foundry, including `forge` and `anvil`, for contract tests or blockchain-backed proofs
- Kubo, if you want development content stored through IPFS instead of the local fallback

### Install

```bash
npm install
```

### Run the development app

For the smallest local setup, create `.env.local` with development-only investigator access:

```dotenv
SENTINEL_DEMO_MODE=true
```

Then start Next.js:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The demo investigator password is `sentinel-demo`. Do not enable this mode outside a private local environment.

### Configure investigator credentials

For a non-demo local setup, use explicit credentials instead:

```dotenv
INVESTIGATOR_PASSWORD=replace-with-a-local-password
SESSION_SECRET=replace-with-a-long-random-secret
```

The application uses an HTTP-only, strict, eight-hour investigator session cookie. Never commit `.env.local` or real credentials.

### Run Anvil and deploy the registry

Start a local chain in one terminal:

```bash
anvil --host 127.0.0.1 --port 8545
```

Set the relay private key to one of Anvil's funded development keys, then deploy `EvidenceRegistry` using the corresponding relay address:

```bash
export ANVIL_RPC_URL=http://127.0.0.1:8545
export RELAY_PRIVATE_KEY=0xYourAnvilPrivateKey
export RELAY_ADDRESS=0xMatchingRelayAddress
forge create contracts/EvidenceRegistry.sol:EvidenceRegistry \
  --rpc-url "$ANVIL_RPC_URL" \
  --private-key "$RELAY_PRIVATE_KEY" \
  --constructor-args "$RELAY_ADDRESS"
```

Copy the deployed contract address into `.env.local`:

```dotenv
ANVIL_RPC_URL=http://127.0.0.1:8545
RELAY_PRIVATE_KEY=0xYourAnvilPrivateKey
REGISTRY_ADDRESS=0xYourDeployedEvidenceRegistryAddress
```

The relay is the only address allowed to write to `EvidenceRegistry`. Never use an Anvil private key on a real network.

### Run Kubo/IPFS locally

If Kubo is running with its API on the default address, no extra setting is needed. To use another endpoint:

```dotenv
IPFS_API_URL=http://127.0.0.1:5001
```

The app pins encrypted evidence with Kubo's `/api/v0/add?pin=true` endpoint. If Kubo is unavailable, development falls back to `data/content`; production does not.

## Environment Variables

| Variable | Purpose | Required |
| --- | --- | --- |
| `INVESTIGATOR_PASSWORD` | Investigator login password | Required outside demo mode |
| `SESSION_SECRET` | Signs investigator session cookies | Required outside demo mode |
| `SENTINEL_DEMO_MODE` | Enables local-only demo credentials when set to `true` | Development only |
| `SENTINEL_DATA_DIR` | Overrides the local data directory | No; defaults to `./data` |
| `IPFS_API_URL` | Kubo API endpoint | No in development; required for IPFS-backed storage |
| `ANVIL_RPC_URL` | Anvil JSON-RPC endpoint | No; defaults to `http://127.0.0.1:8545` |
| `REGISTRY_ADDRESS` | Deployed `EvidenceRegistry` address | Required for blockchain-backed proofs |
| `RELAY_PRIVATE_KEY` | Server relay wallet private key | Required for blockchain-backed proofs |

## Routes

### Browser routes

- `/` — Public product entry point
- `/submit` — Anonymous report and evidence submission
- `/case` — Recovery-code case access
- `/investigator` — Authenticated investigator workspace

### API routes

- `POST /api/cases` — Create a case from an encrypted submission
- `GET /api/cases/[caseId]` — Read a case after recovery-secret verification
- `POST /api/cases/[caseId]/messages` — Add an encrypted whistleblower message
- `POST /api/investigator/login` — Start an investigator session
- `POST /api/investigator/logout` — End an investigator session
- `GET /api/investigator/public-key` — Return the investigator public key for case-key wrapping
- `GET /api/investigator/cases` — List cases for the authenticated investigator
- `GET /api/investigator/cases/[caseId]` — Read an investigator-authorized case
- `POST /api/investigator/cases/[caseId]/messages` — Add an encrypted investigator reply
- `POST /api/investigator/cases/[caseId]/status` — Update case status

## Scripts

```bash
npm run dev            # Start the Next.js development server
npm run build          # Create a production Next.js build
npm start              # Start the production server after building
npm run lint           # Run ESLint
npm test               # Run the Vitest suite once
npm run test:watch     # Run Vitest in watch mode
npm run contract:test  # Run Foundry contract tests
```

## Project Structure

```text
gpt-test-v2/
├── app/
│   ├── api/                         # Case and investigator API routes
│   ├── case/                        # Recovery-code case access page
│   ├── investigator/                # Investigator workspace page
│   ├── submit/                      # Anonymous submission page
│   ├── globals.css                  # Global visual system and responsive styles
│   ├── layout.tsx                   # Root layout and metadata
│   └── page.tsx                     # Public landing page
├── components/
│   ├── case-access.tsx              # Recovery flow and case view
│   ├── investigator-workspace.tsx   # Investigator login and case workflow
│   ├── site-header.tsx              # Shared navigation
│   └── submit-form.tsx              # Browser encryption and upload flow
├── lib/
│   ├── auth.ts                      # Investigator credentials and sessions
│   ├── chain.ts                     # Relay writes and proof verification
│   ├── client-evidence.ts           # Browser image processing and evidence prep
│   ├── content-store.ts             # Kubo/IPFS and local development storage
│   ├── crypto.ts                    # AES-GCM, SHA-256, and envelope parsing
│   ├── encrypted-ingress.ts         # Encrypted API boundary validation
│   ├── evidence.ts                  # Evidence bundle validation
│   ├── integrity.ts                 # Hash and proof integrity checks
│   ├── investigator-keys.ts         # RSA investigator key store
│   ├── key-wrap.ts                  # Case-key wrapping and unwrapping
│   └── repository.ts                # SQLite case and message persistence
├── contracts/
│   └── EvidenceRegistry.sol          # Relay-controlled proof registry
├── contract-test/
│   └── EvidenceRegistry.t.sol       # Foundry contract tests
├── tests/                            # Vitest unit and integration tests
├── foundry.toml                      # Foundry compiler and test configuration
├── next.config.ts                    # Next.js server package configuration
├── package.json                       # Dependencies and npm scripts
└── README.md
```

## Contract Surface

### `EvidenceRegistry`

- `registerCase(caseId, evidenceHash, contentId)` — Register the initial evidence proof.
- `appendMessage(caseId, messageHash)` — Anchor a case message hash.
- `updateStatus(caseId, status)` — Anchor `Submitted`, `UnderReview`, or `Resolved` status.
- `cases(caseId)` — Read the registered evidence hash, content identifier, status, and registration flag.

Only the immutable `relay` address can write. The contract stores hashes, a content identifier, and status—not plaintext reports or case secrets.

## Tests and Validation

Run the application checks before handing off changes:

```bash
npm test
npm run lint
npm run build
npm run contract:test
```

The test suite covers authentication, credential verification, encrypted ingress, browser/server cryptography, content storage, evidence integrity, repository behavior, and blockchain relay behavior. Foundry tests cover registry registration, duplicate prevention, and relay-only writes.

## Security and Privacy Boundaries

- Never add identity collection, analytics, wallet flows, or identifying request logging to the whistleblower path.
- Never persist plaintext reports, images, messages, case secrets, or original image metadata.
- Keep case secrets out of URLs, blockchain events, database keys, and logs.
- Redact authorization headers and request bodies from application logs.
- Do not reuse local Anvil keys or demo investigator credentials outside development.
- A receipt is issued only after encrypted content storage and its integrity proof both succeed.
- A failed integrity check must block decryption and be visible to the user.
- The current MVP supports report text and up to five JPEG/PNG files at 10 MB each. It does not support PDFs, arbitrary files, attachment replies, notifications, or multi-agency administration.

## Scope

Sentinel Proof is intentionally small: one organization, one preconfigured investigator, one local SQLite persistence layer, one relay-controlled registry, and no second persistence service. It is a development and demonstration project, not a production whistleblower platform or a mainnet deployment.
