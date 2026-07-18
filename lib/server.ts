import { CaseRepository } from "@/lib/repository";

let repository: CaseRepository | undefined;

export function caseRepository(): CaseRepository {
  repository ??= new CaseRepository();
  return repository;
}
