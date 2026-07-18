import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const demoSessionSecret = randomBytes(32).toString("base64url");

type AuthEnvironment = Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV" | "INVESTIGATOR_PASSWORD" | "SESSION_SECRET" | "SENTINEL_DEMO_MODE">>;

export type InvestigatorAuth = {
  password: string;
  sessionSecret: string;
};

function sessionSignature(expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(`sentinel-investigator:${expiresAt}`).digest("base64url");
}

function equalDigest(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();

  return timingSafeEqual(leftDigest, rightDigest);
}

export function createSessionToken(secret: string, now = Date.now()): string {
  const expiresAt = now + sessionLifetimeMs;

  return `${expiresAt}.${sessionSignature(expiresAt, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token) {
    return false;
  }

  const [rawExpiry, signature, ...rest] = token.split(".");
  const expiresAt = Number(rawExpiry);

  if (rest.length > 0 || !Number.isSafeInteger(expiresAt) || expiresAt <= now || !signature) {
    return false;
  }

  return equalDigest(signature, sessionSignature(expiresAt, secret));
}

export function verifyPassword(candidate: string, expected: string): boolean {
  return Boolean(candidate) && Boolean(expected) && equalDigest(candidate, expected);
}

export function resolveInvestigatorAuth(environment: AuthEnvironment = process.env): InvestigatorAuth | undefined {
  const password = environment.INVESTIGATOR_PASSWORD;
  const session = environment.SESSION_SECRET;
  const production = environment.NODE_ENV === "production";

  if (
    password &&
    session &&
    (!production || (password !== "sentinel-demo" && session !== "sentinel-development-session-secret"))
  ) {
    return { password, sessionSecret: session };
  }

  if (!production && environment.SENTINEL_DEMO_MODE === "true") {
    // ponytail: local-only demo mode; set real credentials before sharing the app.
    return { password: "sentinel-demo", sessionSecret: demoSessionSecret };
  }

  return undefined;
}

export function investigatorPassword(): string | undefined {
  return resolveInvestigatorAuth()?.password;
}

export function sessionSecret(): string | undefined {
  return resolveInvestigatorAuth()?.sessionSecret;
}
