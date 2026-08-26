import type { DomainResult } from "./types";

const CSV_COLUMNS: Array<{ key: string; label: string; value: (result: DomainResult) => string }> = [
  { key: "originalInput", label: "original input", value: (result) => result.originalInput },
  { key: "normalizedDomain", label: "normalized domain", value: (result) => result.normalizedDomain },
  { key: "tld", label: "TLD", value: (result) => result.tld },
  { key: "status", label: "status", value: (result) => result.status },
  { key: "availabilityGuess", label: "availability guess", value: (result) => result.availabilityGuess },
  { key: "registrar", label: "registrar", value: (result) => result.registrar },
  { key: "nameservers", label: "nameservers", value: (result) => result.nameservers.join("; ") },
  { key: "notes", label: "notes or error message", value: (result) => result.notes },
  { key: "checkedAt", label: "checked timestamp", value: (result) => result.checkedAt },
  { key: "fromCache", label: "from cache", value: (result) => (result.fromCache ? "yes" : "no") }
];

export function resultsToCsv(results: DomainResult[]): string {
  const header = CSV_COLUMNS.map((column) => escapeCsv(column.label)).join(",");
  const rows = results.map((result) =>
    CSV_COLUMNS.map((column) => escapeCsv(column.value(result))).join(",")
  );

  return [header, ...rows].join("\n");
}

export function downloadCsv(results: DomainResult[], filename = "rdap-domain-results.csv") {
  const blob = new Blob([resultsToCsv(results)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
