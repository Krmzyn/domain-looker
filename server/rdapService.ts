import type { CheckResponse, DomainResult, NormalizedDomain } from "./types.js";
import { normalizeInput } from "./normalization.js";
import { makeResult, summarize } from "./results.js";

const IANA_RDAP_BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000;
const RESULT_TTL_MS = 15 * 60 * 1000;
const RDAP_TIMEOUT_MS = 8000;
const BOOTSTRAP_TIMEOUT_MS = 10000;
const GLOBAL_CONCURRENCY = 4;

type FetchLike = typeof fetch;

interface RdapBootstrap {
  publication: string | null;
  services: [string[], string[]][];
}

interface BootstrapCache {
  fetchedAt: number;
  publication: string | null;
  servicesByTld: Map<string, string[]>;
}

interface CachedResult {
  cachedAt: number;
  result: DomainResult;
}

interface DomainTask {
  key: string;
  normalized: NormalizedDomain;
  rdapBaseUrl: string;
  host: string;
}

export interface RdapCheckerOptions {
  fetchImpl?: FetchLike;
  now?: () => Date;
  bootstrapUrl?: string;
  bootstrapTtlMs?: number;
  resultTtlMs?: number;
  rdapTimeoutMs?: number;
  bootstrapTimeoutMs?: number;
  globalConcurrency?: number;
}

export function createRdapChecker(options: RdapCheckerOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const bootstrapUrl = options.bootstrapUrl ?? IANA_RDAP_BOOTSTRAP_URL;
  const bootstrapTtlMs = options.bootstrapTtlMs ?? BOOTSTRAP_TTL_MS;
  const resultTtlMs = options.resultTtlMs ?? RESULT_TTL_MS;
  const rdapTimeoutMs = options.rdapTimeoutMs ?? RDAP_TIMEOUT_MS;
  const bootstrapTimeoutMs = options.bootstrapTimeoutMs ?? BOOTSTRAP_TIMEOUT_MS;
  const globalConcurrency = options.globalConcurrency ?? GLOBAL_CONCURRENCY;

  let bootstrapCache: BootstrapCache | null = null;
  const resultCache = new Map<string, CachedResult>();

  async function checkInputs(inputs: string[]): Promise<CheckResponse> {
    const checkedAt = now().toISOString();
    const warnings: string[] = [];
    const resultsByKey = new Map<string, DomainResult>();
    const pendingDomains: NormalizedDomain[] = [];
    const seenDomains = new Set<string>();
    let duplicateCount = 0;

    inputs.forEach((input, index) => {
      const normalized = normalizeInput(input);
      if (!normalized.ok) {
        resultsByKey.set(`invalid-${index}`, makeResult({
          originalInput: normalized.originalInput || input,
          normalizedDomain: "",
          tld: "",
          status: "invalid_domain",
          notes: normalized.reason,
          checkedAt,
          fromCache: false
        }));
        return;
      }

      const domain = normalized.value.normalizedDomain;
      if (seenDomains.has(domain)) {
        duplicateCount += 1;
        return;
      }

      seenDomains.add(domain);
      pendingDomains.push(normalized.value);
    });

    const cacheEligibleDomains: NormalizedDomain[] = [];
    for (const normalized of pendingDomains) {
      const cached = getCachedResult(normalized.normalizedDomain);
      if (cached) {
        resultsByKey.set(normalized.normalizedDomain, {
          ...cached,
          originalInput: normalized.originalInput,
          fromCache: true
        });
      } else {
        cacheEligibleDomains.push(normalized);
      }
    }

    let bootstrap: BootstrapCache | null = null;
    if (cacheEligibleDomains.length > 0) {
      try {
        bootstrap = await getBootstrap();
      } catch (error) {
        const note = error instanceof Error ? error.message : "Could not load IANA RDAP bootstrap data.";
        warnings.push(note);
        cacheEligibleDomains.forEach((normalized) => {
          const result = makeResult({
            ...normalized,
            status: "unknown_error",
            notes: note,
            checkedAt,
            fromCache: false
          });
          resultsByKey.set(normalized.normalizedDomain, result);
          putCachedResult(normalized.normalizedDomain, result);
        });
      }
    }

    if (bootstrap) {
      const tasks: DomainTask[] = [];

      for (const normalized of cacheEligibleDomains) {
        const rdapBaseUrl = selectRdapBaseUrl(bootstrap.servicesByTld.get(normalized.tld));

        if (!rdapBaseUrl) {
          const result = makeResult({
            ...normalized,
            status: "unsupported_tld",
            notes: `No RDAP server is listed in the IANA bootstrap data for .${normalized.tld}.`,
            checkedAt,
            fromCache: false
          });
          resultsByKey.set(normalized.normalizedDomain, result);
          putCachedResult(normalized.normalizedDomain, result);
          continue;
        }

        tasks.push({
          key: normalized.normalizedDomain,
          normalized,
          rdapBaseUrl,
          host: getUrlHost(rdapBaseUrl)
        });
      }

      const rdapResults = await runDomainTasks(tasks, globalConcurrency, async (task) => {
        const result = await lookupDomain(task.normalized, task.rdapBaseUrl, checkedAt);
        putCachedResult(task.normalized.normalizedDomain, result);
        return result;
      });

      rdapResults.forEach((result, index) => {
        resultsByKey.set(tasks[index].key, result);
      });
    }

    const orderedResults = buildOrderedResults(inputs, resultsByKey);

    return {
      results: orderedResults,
      summary: summarize(orderedResults),
      duplicateCount,
      checkedCount: orderedResults.length,
      bootstrapPublication: bootstrapCache?.publication ?? null,
      warnings
    };
  }

  async function getBootstrap(): Promise<BootstrapCache> {
    const currentTime = now().getTime();
    if (bootstrapCache && currentTime - bootstrapCache.fetchedAt < bootstrapTtlMs) {
      return bootstrapCache;
    }

    try {
      const response = await fetchWithTimeout(
        bootstrapUrl,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "Domain-Looker-RDAP-Prechecker/1.0"
          }
        },
        bootstrapTimeoutMs,
        fetchImpl
      );

      if (!response.ok) {
        throw new Error(`IANA RDAP bootstrap returned HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as RdapBootstrap;
      const servicesByTld = parseBootstrapServices(payload);

      bootstrapCache = {
        fetchedAt: currentTime,
        publication: payload.publication ?? null,
        servicesByTld
      };

      return bootstrapCache;
    } catch (error) {
      if (bootstrapCache) {
        return bootstrapCache;
      }

      if (error instanceof Error) {
        throw new Error(`Could not load IANA RDAP bootstrap data: ${error.message}`);
      }

      throw new Error("Could not load IANA RDAP bootstrap data.");
    }
  }

  async function lookupDomain(
    normalized: NormalizedDomain,
    rdapBaseUrl: string,
    checkedAt: string
  ): Promise<DomainResult> {
    const url = buildRdapDomainUrl(rdapBaseUrl, normalized.normalizedDomain);

    try {
      const response = await fetchWithTimeout(
        url,
        {
          headers: {
            Accept: "application/rdap+json, application/json",
            "User-Agent": "Domain-Looker-RDAP-Prechecker/1.0"
          },
          redirect: "follow"
        },
        rdapTimeoutMs,
        fetchImpl
      );

      if (response.status === 404) {
        return makeResult({
          ...normalized,
          status: "likely_available",
          notes: "RDAP returned 404 not found. This is only a pre-check; registrar restrictions may still apply.",
          checkedAt,
          fromCache: false
        });
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        return makeResult({
          ...normalized,
          status: "rate_limited",
          notes: retryAfter ? `RDAP server returned HTTP 429. Retry-After: ${retryAfter}.` : "RDAP server returned HTTP 429.",
          checkedAt,
          fromCache: false
        });
      }

      if (!response.ok) {
        return makeResult({
          ...normalized,
          status: "unknown_error",
          notes: `RDAP server returned HTTP ${response.status}.`,
          checkedAt,
          fromCache: false
        });
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return makeResult({
          ...normalized,
          status: "unknown_error",
          notes: "RDAP server returned malformed JSON.",
          checkedAt,
          fromCache: false
        });
      }

      const rdapDomain = payload as Record<string, unknown>;
      if (rdapDomain.objectClassName !== "domain") {
        return makeResult({
          ...normalized,
          status: "unknown_error",
          notes: "RDAP response did not identify a domain object.",
          checkedAt,
          fromCache: false
        });
      }

      return makeResult({
        ...normalized,
        status: "registered",
        registrar: extractRegistrar(rdapDomain),
        nameservers: extractNameservers(rdapDomain),
        notes: "RDAP returned a domain object.",
        checkedAt,
        fromCache: false
      });
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? `RDAP request timed out after ${Math.round(rdapTimeoutMs / 1000)} seconds.`
          : error instanceof Error
            ? error.message
            : "RDAP lookup failed.";

      return makeResult({
        ...normalized,
        status: "unknown_error",
        notes: message,
        checkedAt,
        fromCache: false
      });
    }
  }

  function getCachedResult(domain: string): DomainResult | null {
    const cached = resultCache.get(domain);
    if (!cached) {
      return null;
    }

    if (now().getTime() - cached.cachedAt > resultTtlMs) {
      resultCache.delete(domain);
      return null;
    }

    return cached.result;
  }

  function putCachedResult(domain: string, result: DomainResult) {
    resultCache.set(domain, {
      cachedAt: now().getTime(),
      result
    });
  }

  return {
    checkInputs,
    clearCaches() {
      bootstrapCache = null;
      resultCache.clear();
    }
  };
}

function parseBootstrapServices(payload: RdapBootstrap): Map<string, string[]> {
  const servicesByTld = new Map<string, string[]>();

  if (!Array.isArray(payload.services)) {
    throw new Error("IANA RDAP bootstrap payload did not include services.");
  }

  for (const service of payload.services) {
    const [tlds, urls] = service;
    if (!Array.isArray(tlds) || !Array.isArray(urls)) {
      continue;
    }

    for (const tld of tlds) {
      servicesByTld.set(String(tld).toLowerCase(), urls.map(String));
    }
  }

  return servicesByTld;
}

function selectRdapBaseUrl(urls: string[] | undefined): string | null {
  if (!urls?.length) {
    return null;
  }

  return urls.find((url) => url.startsWith("https://")) ?? urls[0] ?? null;
}

function buildRdapDomainUrl(rdapBaseUrl: string, domain: string): string {
  const base = rdapBaseUrl.endsWith("/") ? rdapBaseUrl : `${rdapBaseUrl}/`;
  return new URL(`domain/${encodeURIComponent(domain)}`, base).toString();
}

function getUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: FetchLike
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function runDomainTasks(
  tasks: DomainTask[],
  globalConcurrency: number,
  worker: (task: DomainTask) => Promise<DomainResult>
): Promise<DomainResult[]> {
  const results: DomainResult[] = new Array(tasks.length);
  const hostActive = new Set<string>();
  let active = 0;
  let completed = 0;

  return await new Promise((resolve) => {
    const schedule = () => {
      if (completed === tasks.length) {
        resolve(results);
        return;
      }

      while (active < globalConcurrency) {
        const index = tasks.findIndex((task, taskIndex) => !results[taskIndex] && !hostActive.has(task.host));
        if (index === -1) {
          break;
        }

        const task = tasks[index];
        hostActive.add(task.host);
        active += 1;
        results[index] = makePlaceholder(task.normalized);

        worker(task)
          .then((result) => {
            results[index] = result;
          })
          .finally(() => {
            hostActive.delete(task.host);
            active -= 1;
            completed += 1;
            schedule();
          });
      }
    };

    schedule();
  });
}

function buildOrderedResults(inputs: string[], resultsByKey: Map<string, DomainResult>): DomainResult[] {
  const ordered: DomainResult[] = [];
  const emitted = new Set<string>();

  inputs.forEach((input, index) => {
    const normalized = normalizeInput(input);
    if (!normalized.ok) {
      const invalidResult = resultsByKey.get(`invalid-${index}`);
      if (invalidResult) {
        ordered.push(invalidResult);
      }
      return;
    }

    const domain = normalized.value.normalizedDomain;
    if (emitted.has(domain)) {
      return;
    }

    const result = resultsByKey.get(domain);
    if (result) {
      ordered.push(result);
      emitted.add(domain);
    }
  });

  return ordered;
}

function makePlaceholder(normalized: NormalizedDomain): DomainResult {
  return makeResult({
    ...normalized,
    status: "unknown_error",
    notes: "Pending lookup.",
    checkedAt: new Date(0).toISOString(),
    fromCache: false
  });
}

function extractRegistrar(rdapDomain: Record<string, unknown>): string {
  const entities = Array.isArray(rdapDomain.entities) ? rdapDomain.entities : [];

  for (const entity of entities) {
    if (!isObject(entity)) {
      continue;
    }

    const roles = Array.isArray(entity.roles) ? entity.roles.map(String) : [];
    if (!roles.includes("registrar")) {
      continue;
    }

    return extractEntityName(entity) || stringValue(entity.handle);
  }

  return "";
}

function extractEntityName(entity: Record<string, unknown>): string {
  const vcardArray = entity.vcardArray;
  if (!Array.isArray(vcardArray) || !Array.isArray(vcardArray[1])) {
    return "";
  }

  const preferred = ["fn", "org"];
  for (const key of preferred) {
    const value = findVcardValue(vcardArray[1], key);
    if (value) {
      return value;
    }
  }

  return "";
}

function findVcardValue(properties: unknown[], key: string): string {
  for (const property of properties) {
    if (!Array.isArray(property) || property.length < 4) {
      continue;
    }

    if (String(property[0]).toLowerCase() !== key) {
      continue;
    }

    const value = property[3];
    if (Array.isArray(value)) {
      return value.map(String).join(" ").trim();
    }

    return stringValue(value);
  }

  return "";
}

function extractNameservers(rdapDomain: Record<string, unknown>): string[] {
  const nameservers = Array.isArray(rdapDomain.nameservers) ? rdapDomain.nameservers : [];

  return nameservers
    .filter(isObject)
    .map((nameserver) => stringValue(nameserver.ldhName) || stringValue(nameserver.unicodeName))
    .filter(Boolean)
    .map((name) => name.toLowerCase())
    .slice(0, 8);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
