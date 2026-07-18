import { describe, expect, test } from "vitest";
import { createSessionToken, resolveInvestigatorAuth, verifyPassword, verifySessionToken } from "@/lib/auth";

describe("investigator access", () => {
  test("creates a verifiable, expiring signed session", () => {
    const token = createSessionToken("session-secret", 10_000);

    expect(verifySessionToken(token, "session-secret", 10_100)).toBe(true);
    expect(verifySessionToken(token, "session-secret", 30_000_001)).toBe(false);
  });

  test("rejects a changed token or wrong password", () => {
    const token = createSessionToken("session-secret", 10_000);

    expect(verifySessionToken(`${token}x`, "session-secret", 10_100)).toBe(false);
    expect(verifyPassword("not-the-password", "demo-password")).toBe(false);
    expect(verifyPassword("demo-password", "demo-password")).toBe(true);
  });

  test("requires explicit production credentials and an explicit local demo mode", () => {
    expect(resolveInvestigatorAuth({ NODE_ENV: "production" })).toBeUndefined();
    expect(resolveInvestigatorAuth({ NODE_ENV: "production", SENTINEL_DEMO_MODE: "true" })).toBeUndefined();
    expect(resolveInvestigatorAuth({ NODE_ENV: "development" })).toBeUndefined();

    const demo = resolveInvestigatorAuth({ NODE_ENV: "development", SENTINEL_DEMO_MODE: "true" });
    expect(demo?.password).toBe("sentinel-demo");
    expect(demo?.sessionSecret).not.toBe("sentinel-development-session-secret");

    expect(
      resolveInvestigatorAuth({
        NODE_ENV: "production",
        INVESTIGATOR_PASSWORD: "strong-password",
        SESSION_SECRET: "long-unpredictable-session-secret"
      })
    ).toEqual({ password: "strong-password", sessionSecret: "long-unpredictable-session-secret" });
  });
});
