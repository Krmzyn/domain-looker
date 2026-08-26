import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileDown,
  Globe2,
  Loader2,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  WifiOff
} from "lucide-react";
import { checkDomains } from "./api";
import { downloadCsv, resultsToCsv } from "./csv";
import type { CheckResponse, DomainResult, DomainStatus } from "./types";
import { DOMAIN_STATUSES } from "./types";

const SAMPLE_INPUT = `example.com
https://www.example.org/pricing
my-brand-idea-2026.com
[Our blog](https://blog.example.net/launch)
not a domain`;

const STATUS_LABELS: Record<DomainStatus, string> = {
  registered: "Registered",
  likely_available: "Likely available",
  invalid_domain: "Invalid",
  unsupported_tld: "Unsupported",
  rate_limited: "Rate-limited",
  unknown_error: "Unknown"
};

const STATUS_DESCRIPTIONS: Record<DomainStatus, string> = {
  registered: "RDAP returned a domain object.",
  likely_available: "RDAP returned not found; registrar availability is not guaranteed.",
  invalid_domain: "Input could not be normalized into a valid domain.",
  unsupported_tld: "IANA bootstrap has no RDAP service for this TLD.",
  rate_limited: "The RDAP server asked us to slow down.",
  unknown_error: "The lookup did not produce a reliable answer."
};

const STATUS_ICONS: Record<DomainStatus, typeof CheckCircle2> = {
  registered: CheckCircle2,
  likely_available: Clock3,
  invalid_domain: AlertCircle,
  unsupported_tld: WifiOff,
  rate_limited: ShieldAlert,
  unknown_error: AlertCircle
};

type StatusFilter = DomainStatus | "all";

function App() {
  const [bulkInput, setBulkInput] = useState(SAMPLE_INPUT);
  const [response, setResponse] = useState<CheckResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const inputLines = useMemo(() => splitLines(bulkInput), [bulkInput]);
  const isOverLimit = inputLines.length > 100;
  const results = response?.results ?? [];
  const filteredResults = useMemo(() => {
    if (statusFilter === "all") {
      return results;
    }

    return results.filter((result) => result.status === statusFilter);
  }, [results, statusFilter]);

  const hasResults = results.length > 0;
  const summary = response?.summary;
  const totalVisible = filteredResults.length;

  async function handleCheck() {
    setError("");
    setCopyState("idle");

    if (inputLines.length === 0) {
      setError("Paste at least one domain or URL.");
      return;
    }

    if (isOverLimit) {
      setError("A check can include up to 100 inputs.");
      return;
    }

    setIsLoading(true);

    try {
      const nextResponse = await checkDomains(inputLines);
      setResponse(nextResponse);
      setStatusFilter("all");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Domain check failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    setBulkInput("");
    setResponse(null);
    setStatusFilter("all");
    setError("");
    setCopyState("idle");
  }

  async function handleCopyCsv() {
    try {
      await navigator.clipboard.writeText(resultsToCsv(filteredResults));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Globe2 size={22} strokeWidth={2.1} />
          </span>
          <div>
            <h1>Domain Looker</h1>
            <p>Bulk domain availability pre-checks powered by official RDAP data.</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" type="button" disabled={!hasResults} onClick={handleCopyCsv}>
            <Copy size={16} />
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy CSV"}
          </button>
          <button className="secondary-button" type="button" disabled={!hasResults} onClick={() => downloadCsv(filteredResults)}>
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="input-panel" aria-label="Domain input">
          <div className="panel-heading">
            <div>
              <h2>Input</h2>
              <p>Paste domains or URLs, one per line.</p>
            </div>
            <span className={isOverLimit ? "line-count warning" : "line-count"}>{inputLines.length}/100</span>
          </div>

          <label className="textarea-label" htmlFor="bulk-input">
            Domains and URLs
          </label>
          <textarea
            id="bulk-input"
            value={bulkInput}
            onChange={(event) => setBulkInput(event.target.value)}
            spellCheck={false}
            placeholder="example.com&#10;https://brand.example/about&#10;my-brand-idea.com"
          />

          <div className="input-actions">
            <button className="primary-button" type="button" disabled={isLoading || isOverLimit} onClick={handleCheck}>
              {isLoading ? <Loader2 className="spin" size={17} /> : <Search size={17} />}
              Check RDAP
            </button>
            <button className="icon-button" type="button" aria-label="Clear input and results" onClick={handleClear}>
              <Trash2 size={17} />
            </button>
          </div>

          <div className="note-box">
            <p>
              Duplicates are removed before lookup. Results are cached for 15 minutes while this server is running.
            </p>
          </div>

          {error ? (
            <div className="error-box" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          ) : null}
        </aside>

        <section className="results-panel" aria-label="RDAP results">
          <div className="results-header">
            <div>
              <h2>Results</h2>
              <p>
                {hasResults
                  ? `${response?.checkedCount ?? 0} unique rows checked${response?.duplicateCount ? `, ${response.duplicateCount} duplicate skipped` : ""}.`
                  : "Run a check to populate the table."}
              </p>
            </div>
            <div className="cache-meta">
              <RotateCcw size={15} />
              <span>{response?.bootstrapPublication ? `IANA bootstrap ${response.bootstrapPublication}` : "Bootstrap cache ready on first run"}</span>
            </div>
          </div>

          <div className="summary-grid" aria-label="Status summary">
            {DOMAIN_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={`summary-card status-${status} ${statusFilter === status ? "active" : ""}`}
                onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
                aria-pressed={statusFilter === status}
                title={STATUS_DESCRIPTIONS[status]}
              >
                <span className="summary-label">{STATUS_LABELS[status]}</span>
                <strong>{summary?.[status] ?? 0}</strong>
              </button>
            ))}
          </div>

          <div className="table-toolbar">
            <div className="filter-tabs" aria-label="Result filters">
              <button
                type="button"
                className={statusFilter === "all" ? "active" : ""}
                aria-pressed={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
              >
                All
              </button>
              {DOMAIN_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={statusFilter === status ? "active" : ""}
                  aria-pressed={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
            <span className="visible-count">{totalVisible} visible</span>
          </div>

          {isLoading ? (
            <div className="progress-strip" role="status">
              <Loader2 className="spin" size={18} />
              <span>Checking RDAP servers with conservative concurrency...</span>
            </div>
          ) : null}

          {response?.warnings.length ? (
            <div className="warning-list" role="status">
              {response.warnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          ) : null}

          <ResultTable results={filteredResults} />
        </section>
      </section>

      <footer className="footer-note">
        RDAP pre-check only. A “likely available” result is not a guarantee that a domain is purchasable, unrestricted, or non-premium at a registrar.
      </footer>
    </main>
  );
}

function ResultTable({ results }: { results: DomainResult[] }) {
  if (!results.length) {
    return (
      <div className="empty-state">
        <FileDown size={30} />
        <p>No rows to show.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Original input</th>
            <th>Normalized domain</th>
            <th>TLD</th>
            <th>Status</th>
            <th>Availability guess</th>
            <th>Registrar</th>
            <th>Nameservers</th>
            <th>Notes</th>
            <th>Checked timestamp</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={`${result.originalInput}-${result.normalizedDomain}-${result.checkedAt}`}>
              <td className="mono-cell">{result.originalInput}</td>
              <td className="domain-cell">
                {result.normalizedDomain || "—"}
                {result.fromCache ? <span className="cache-pill">cache</span> : null}
              </td>
              <td>{result.tld || "—"}</td>
              <td>
                <StatusChip status={result.status} />
              </td>
              <td>{result.availabilityGuess}</td>
              <td>{result.registrar || "—"}</td>
              <td className="nameserver-cell">{result.nameservers.length ? result.nameservers.join(", ") : "—"}</td>
              <td className="notes-cell">{result.notes}</td>
              <td className="timestamp-cell">{formatTimestamp(result.checkedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusChip({ status }: { status: DomainStatus }) {
  const Icon = STATUS_ICONS[status];

  return (
    <span className={`status-chip status-${status}`}>
      <Icon size={14} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default App;
