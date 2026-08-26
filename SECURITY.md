# Security Policy

## Reporting a vulnerability

If you discover a security issue in Domain Looker, please report it privately
rather than opening a public issue:

- Use GitHub's **[Report a vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)**
  feature (Security → Advisories → *Report a vulnerability*) on this repository.

Please include steps to reproduce and the potential impact. You can expect an
acknowledgement within a reasonable timeframe for a project of this size.

## Scope and design notes

Domain Looker is a self-hosted tool with a deliberately small attack surface:

- **No credentials.** It requires no API keys, tokens, or database. It talks
  only to the public IANA RDAP bootstrap (`data.iana.org`) and the public RDAP
  servers that bootstrap points to.
- **No persistence.** Results are cached in memory only, for 15 minutes, and are
  lost when the server stops. Nothing is written to disk.
- **Input is validated.** Requests are schema-validated (max 100 inputs, 80 KB
  body limit) before any lookup runs.
- **Errors are not leaked.** Unexpected server errors return a generic message;
  details are logged server-side only.

Because the server makes outbound requests to RDAP endpoints derived from the
IANA bootstrap file, treat it as you would any tool that performs outbound HTTP:
run it in an environment where that is acceptable.

## Supported versions

This is a portfolio project; only the latest `main` branch is maintained.
