import { describe, expect, test } from "vitest";
import { readJsonResponse } from "@/lib/response";

describe("API response parsing", () => {
  test("turns an empty failed response into a useful error", async () => {
    await expect(readJsonResponse(new Response(null, { status: 500 }))).rejects.toThrow("Request failed (500)");
  });

  test("parses a JSON response body", async () => {
    await expect(readJsonResponse<{ ok: boolean }>(Response.json({ ok: true }))).resolves.toEqual({ ok: true });
  });
});
