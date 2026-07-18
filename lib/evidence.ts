export type EvidenceFileLike = {
  name: string;
  type: string;
  size: number;
};

const allowedImageTypes = new Set(["image/jpeg", "image/png"]);
const maximumFiles = 5;
const maximumFileSize = 10 * 1024 * 1024;

export function validateEvidenceFiles(files: EvidenceFileLike[]): string[] {
  const errors: string[] = [];

  if (files.length > maximumFiles) {
    errors.push("You can attach up to five images");
  }

  if (files.some((file) => !allowedImageTypes.has(file.type))) {
    errors.push("Only JPEG and PNG images are accepted");
  }

  if (files.some((file) => file.size > maximumFileSize)) {
    errors.push("Each image must be 10 MB or smaller");
  }

  return errors;
}
