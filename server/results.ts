import type { DomainResult, DomainStatus, Summary } from "./types.js";
import { DOMAIN_STATUSES } from "./types.js";

export interface MakeResultInput {
  originalInput: string;
  normalizedDomain: string;
  tld: string;
  status: DomainStatus;
  registrar?: string;
  nameservers?: string[];
  notes: string;
  checkedAt: string;
  fromCache?: boolean;
}

export function makeResult(input: MakeResultInput): DomainResult {
  return {
    originalInput: input.originalInput,
    normalizedDomain: input.normalizedDomain,
    tld: input.tld,
    status: input.status,
    availabilityGuess: availabilityGuessFor(input.status),
    registrar: input.registrar ?? "",
    nameservers: input.nameservers ?? [],
    notes: input.notes,
    checkedAt: input.checkedAt,
    fromCache: input.fromCache ?? false
  };
}

export function summarize(results: DomainResult[]): Summary {
  const summary = Object.fromEntries(DOMAIN_STATUSES.map((status) => [status, 0])) as Summary;

  for (const result of results) {
    summary[result.status] += 1;
  }

  return summary;
}

export function availabilityGuessFor(status: DomainStatus): string {
  switch (status) {
    case "registered":
      return "Registered";
    case "likely_available":
      return "Likely available, not guaranteed";
    case "invalid_domain":
      return "Invalid input";
    case "unsupported_tld":
      return "Unsupported RDAP TLD";
    case "rate_limited":
      return "Try again later";
    case "unknown_error":
      return "Could not determine";
  }
}
