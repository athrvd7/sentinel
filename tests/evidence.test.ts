import { describe, expect, test } from "vitest";
import { validateEvidenceFiles } from "@/lib/evidence";

describe("evidence file validation", () => {
  test("accepts up to five JPEG or PNG files at the size limit", () => {
    const files = Array.from({ length: 5 }, (_, index) => ({
      name: `proof-${index}.png`,
      type: "image/png",
      size: 10 * 1024 * 1024
    }));

    expect(validateEvidenceFiles(files)).toEqual([]);
  });

  test("rejects unsupported, oversized, and excess files before upload", () => {
    expect(validateEvidenceFiles([{ name: "memo.pdf", type: "application/pdf", size: 4 }])).toContain(
      "Only JPEG and PNG images are accepted"
    );
    expect(validateEvidenceFiles([{ name: "large.jpg", type: "image/jpeg", size: 10 * 1024 * 1024 + 1 }])).toContain(
      "Each image must be 10 MB or smaller"
    );
    expect(validateEvidenceFiles(Array.from({ length: 6 }, () => ({ name: "a.png", type: "image/png", size: 4 })))).toContain(
      "You can attach up to five images"
    );
  });
});
