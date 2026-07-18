import { bytesToBase64Url } from "@/lib/encoding";
import { deriveAesKey, encryptText, type EncryptedEnvelope } from "@/lib/crypto";
import { validateEvidenceFiles } from "@/lib/evidence";

export type EvidencePayload = {
  report: string;
  attachments: Array<{ name: string; type: "image/png"; data: string }>;
};

async function sanitizeImage(file: File, index: number): Promise<EvidencePayload["attachments"][number]> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    throw new Error("Image sanitization is unavailable in this browser");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Image sanitization failed"))), "image/png");
  });

  return {
    name: `evidence-${index + 1}.png`,
    type: "image/png",
    data: bytesToBase64Url(new Uint8Array(await blob.arrayBuffer()))
  };
}

export async function createEncryptedEvidence(
  report: string,
  files: File[],
  secret: string
): Promise<EncryptedEnvelope> {
  const errors = validateEvidenceFiles(files);

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  const payload: EvidencePayload = {
    report: report.trim(),
    attachments: await Promise.all(files.map(sanitizeImage))
  };

  return encryptText(JSON.stringify(payload), await deriveAesKey(secret));
}

export async function decryptEvidence(envelope: EncryptedEnvelope, secret: string): Promise<EvidencePayload> {
  const { decryptText } = await import("@/lib/crypto");
  return JSON.parse(await decryptText(envelope, await deriveAesKey(secret))) as EvidencePayload;
}
