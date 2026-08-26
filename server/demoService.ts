import type { CheckResponse, DomainResult, NormalizedDomain } from "./types.js";
import { normalizeInput } from "./normalization.js";
import { makeResult, summarize } from "./results.js";

const DEMO_WARNING =
  "Demo mode is on. Results are simulated locally and do not reflect live RDAP data.";

// A few well-known names always read as registered so the demo stays believable.
const KNOWN_REGISTERED = new Set(["example.com", "example.org", "example.net", "github.com", "google.com"]);

const DEMO_REGISTRARS = ["Example Registrar, Inc.", "Demo Domains LLC", "Placeholder Registrar SA"];

export interface DemoCheckerOptions {
  now?: () => Date;
}

/**
 * An offline stand-in for the RDAP checker. It reuses the real input
 * normalization and de-duplication, but returns deterministic, simulated
 * statuses instead of making any network calls. Enable it with the `--demo`
 * flag or `DOMAIN_LOOKER_DEMO=1` so the UI can be explored without live RDAP.
 */
export function createDemoChecker(options: DemoCheckerOptions = {}) {
  const now = options.now ?? (() => new Date());

  async function checkInputs(inputs: string[]): Promise<CheckResponse> {
    const checkedAt = now().toISOString();
    const results: DomainResult[] = [];
    const seenDomains = new Set<string>();
    let duplicateCount = 0;

    for (const input of inputs) {
      const normalized = normalizeInput(input);

      if (!normalized.ok) {
        results.push(
          makeResult({
            originalInput: normalized.originalInput || input,
            normalizedDomain: "",
            tld: "",
            status: "invalid_domain",
            notes: normalized.reason,
            checkedAt
          })
        );
        continue;
      }

      const domain = normalized.value.normalizedDomain;
      if (seenDomains.has(domain)) {
        duplicateCount += 1;
        continue;
      }

      seenDomains.add(domain);
      results.push(simulate(normalized.value, checkedAt));
    }

    return {
      results,
      summary: summarize(results),
      duplicateCount,
      checkedCount: results.length,
      bootstrapPublication: null,
      warnings: [DEMO_WARNING]
    };
  }

  return { checkInputs };
}

function simulate(normalized: NormalizedDomain, checkedAt: string): DomainResult {
  const domain = normalized.normalizedDomain;
  const hash = hashString(domain);

  if (KNOWN_REGISTERED.has(domain) || hash % 3 === 0) {
    return makeResult({
      ...normalized,
      status: "registered",
      registrar: DEMO_REGISTRARS[hash % DEMO_REGISTRARS.length],
      nameservers: [`ns1.${domain}`, `ns2.${domain}`],
      notes: "Demo: simulated RDAP domain object.",
      checkedAt
    });
  }

  return makeResult({
    ...normalized,
    status: "likely_available",
    notes: "Demo: simulated RDAP 404 (not found). Availability is not guaranteed.",
    checkedAt
  });
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}
