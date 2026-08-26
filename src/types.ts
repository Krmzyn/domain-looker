export const DOMAIN_STATUSES = [
  "registered",
  "likely_available",
  "invalid_domain",
  "unsupported_tld",
  "rate_limited",
  "unknown_error"
] as const;

export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

export type Summary = Record<DomainStatus, number>;

export interface DomainResult {
  originalInput: string;
  normalizedDomain: string;
  tld: string;
  status: DomainStatus;
  availabilityGuess: string;
  registrar: string;
  nameservers: string[];
  notes: string;
  checkedAt: string;
  fromCache: boolean;
}

export interface CheckResponse {
  results: DomainResult[];
  summary: Summary;
  duplicateCount: number;
  checkedCount: number;
  bootstrapPublication: string | null;
  warnings: string[];
}
