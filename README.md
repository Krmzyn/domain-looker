# Domain Looker

Bulk domain registration pre-checks using official RDAP data.

Paste domains or URLs, inspect the result for each name, and export a shortlist. Built with React, TypeScript and Express. No API key is required.

[Quick start](#quick-start) · [Architecture](docs/architecture.md) · [Usage](docs/usage.md) · [Case study](https://alexjardinedigital.com/work/domain)

![Domain Looker showing registration statuses for a mixed list of domains and URLs](docs/screenshot-desktop.png)

## Quick start

Requires Node.js 20.19+ or 22.12+ and npm. Start with the deterministic offline demo:

```bash
git clone https://github.com/Krmzyn/domain-looker.git
cd domain-looker
npm ci
npm run dev:demo
```

Open <http://127.0.0.1:5173>. Demo results are simulated and labeled in the interface. To query real RDAP services, stop the demo and run `npm run dev`.

## What it does

- Normalizes domains, URLs, Markdown links and internationalized names to registrable domains.
- Checks up to 100 inputs per request against the registry endpoints in the IANA RDAP bootstrap.
- Distinguishes registered, likely available, invalid, unsupported, rate-limited and unknown results.
- Filters results and exports CSV, with duplicate inputs collapsed before lookup.

**Likely available is a pre-check.** An RDAP 404 does not establish that a registrar will sell a domain. Reserved, restricted and premium-priced names still need a registrar check.

## Engineering decisions

The React interface uses a typed Express API with Zod request validation. The backend resolves authoritative RDAP endpoints, caches results in memory and serializes requests per registry host. A failed lookup stays unknown rather than becoming an available name.

The demo checker implements the same interface as the live checker, so normalization and UI behavior can be exercised without registry traffic.

[Read the architecture and RDAP status mapping](docs/architecture.md).

## Verify locally

```bash
npm run typecheck
npm test
npm run build
```

The suite covers normalization, mocked RDAP responses, the API contract, CSV escaping, demo behavior and the React interface. The existing GitHub Actions workflow runs type checks, tests and a production build on Node 20 and 22.

## Operating limits

This is a self-hosted tool with an in-memory, single-process cache. It has no authentication or per-user rate limiting. Registry concurrency controls are not protection for a public hosted API.

Live lookups send the requested domain to the relevant registry service. Demo mode makes no RDAP requests. See [setup, configuration and production usage](docs/usage.md).

## Contributing

[Contribution guide](CONTRIBUTING.md) · [Security reporting](SECURITY.md) · [MIT license](LICENSE)

Built by [Alex Jardine](https://alexjardinedigital.com), founder of [Jardine Studio](https://jardinestudio.com).
