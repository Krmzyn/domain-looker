import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import { parse } from "tldts";
import type { NormalizedDomain } from "./types.js";

export type NormalizationResult =
  | { ok: true; value: NormalizedDomain }
  | { ok: false; reason: string; originalInput: string };

const MARKDOWN_LINK_PATTERN = /\[[^\]]+]\(([^)\s]+)(?:\s+"[^"]*")?\)/;
const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeInput(input: string): NormalizationResult {
  const originalInput = input.trim();

  if (!originalInput) {
    return invalid(originalInput, "Empty input.");
  }

  const candidate = extractCandidate(originalInput);
  const hostname = extractHostname(candidate);

  if (!hostname) {
    return invalid(originalInput, "Could not find a domain or URL.");
  }

  const asciiHostname = domainToASCII(hostname).toLowerCase().replace(/\.$/, "");

  if (!asciiHostname || isIP(asciiHostname)) {
    return invalid(originalInput, "Input is not a domain name.");
  }

  const labels = asciiHostname.split(".");
  if (!isValidDomainLabels(labels)) {
    return invalid(originalInput, "Domain syntax is invalid.");
  }

  const parsed = parse(asciiHostname, { allowPrivateDomains: false });
  const normalizedDomain = parsed.domain ?? labels.slice(-2).join(".");

  if (!normalizedDomain || !normalizedDomain.includes(".")) {
    return invalid(originalInput, "Domain must include a name and top-level domain.");
  }

  const normalizedLabels = normalizedDomain.split(".");
  if (!isValidDomainLabels(normalizedLabels)) {
    return invalid(originalInput, "Registrable domain syntax is invalid.");
  }

  return {
    ok: true,
    value: {
      originalInput,
      normalizedDomain,
      tld: normalizedLabels.at(-1) ?? ""
    }
  };
}

export function splitBulkInput(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractCandidate(input: string): string {
  const markdownMatch = input.match(MARKDOWN_LINK_PATTERN);
  const candidate = markdownMatch?.[1] ?? input;

  return candidate
    .trim()
    .replace(/^<|>$/g, "")
    .replace(/^`|`$/g, "")
    .replace(/[),.;]+$/g, "");
}

function extractHostname(candidate: string): string | null {
  const withoutScheme = candidate.startsWith("//") ? `https:${candidate}` : candidate;
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(withoutScheme);
  const urlCandidate = hasScheme ? withoutScheme : `https://${withoutScheme}`;

  try {
    const parsedUrl = new URL(urlCandidate);
    return parsedUrl.hostname || null;
  } catch {
    return null;
  }
}

function isValidDomainLabels(labels: string[]): boolean {
  if (labels.length < 2) {
    return false;
  }

  const fullDomain = labels.join(".");
  if (fullDomain.length > 253) {
    return false;
  }

  return labels.every((label) => LABEL_PATTERN.test(label));
}

function invalid(originalInput: string, reason: string): NormalizationResult {
  return { ok: false, reason, originalInput };
}
