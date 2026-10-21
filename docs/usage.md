# Usage

[Back to the README](../README.md)

## Getting started

### Prerequisites

- Node.js ≥ 20.19 (or ≥ 22.12) and npm. Built and tested on Node 24.
- Outbound HTTPS access to `data.iana.org` and public RDAP servers, *or* use
  [demo mode](#demo-mode-offline), which needs no network.

### Installation

```bash
git clone https://github.com/Krmzyn/domain-looker.git
cd domain-looker
npm install
```

### Development

Runs the Vite dev server and the API together with live reload:

```bash
npm run dev
```

- Frontend: <http://127.0.0.1:5173>
- API: <http://127.0.0.1:3001>

Vite proxies `/api` to the backend automatically, so you only need to open the frontend URL.

> [!TIP]
> On Windows, double-clicking `Launch Domain Looker.cmd` installs dependencies (if
> needed) and starts `npm run dev`.

#### Demo mode (offline)

Explore the full UI with simulated, deterministic results and no network calls:

```bash
npm run dev:demo
```

Demo mode reuses the real input normalization and de-duplication, so the app behaves identically.
Only the RDAP results are faked. A banner in the UI makes the mode obvious.

### Environment variables

All variables are optional. Domain Looker needs no keys, tokens, or database. Copy the
template and edit if you like:

```bash
cp .env.example .env
```

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Port the Express server (API + built frontend) listens on. |
| `DOMAIN_LOOKER_DEMO` | *(off)* | Set to `1` or `true` to force demo mode. Equivalent to the `--demo` flag. |

The backend loads `.env` automatically on startup via Node's built-in loader (no dependency).

### Testing

```bash
npm test          # run the Vitest unit + integration suite once
npm run typecheck # TypeScript checks for both frontend and backend
```

Tests cover input normalization, the RDAP status mapping (with a mocked `fetch`), the API contract
(via `supertest`), CSV escaping, the demo checker, and the React UI (via Testing Library + jsdom).

### Production build

```bash
npm run build     # type-check, compile the server to dist-server/, build the frontend to dist/
npm start         # serve the built frontend + API from a single process (defaults to :3001)
```

`npm run preview` does both in one step. In production the Express server serves the static
frontend from `dist/`, so everything runs on one port:

```bash
# Example: build once, then serve on port 8080
npm run build
PORT=8080 npm start
# open http://127.0.0.1:8080
```

## Privacy and data handling

Domain Looker is designed to hold onto as little as possible:

- No accounts, no tracking, no analytics, no cookies. The frontend talks only to its own API.
- No persistence. Results live in an in-memory cache for 15 minutes and are gone when the
  server stops. Nothing is written to disk or a database.
- The domains you check leave your server only as RDAP lookups to the relevant public registry
  RDAP endpoints (and the IANA bootstrap file). That's inherent to how RDAP works: the registry
  has to answer the query. If a list of domains is sensitive, run in [demo mode](#demo-mode-offline)
  or against a private RDAP mirror.
- No secrets to leak. There are no API keys or credentials anywhere in the project.

## Known limitations

- Pre-check, not a purchase check. "Likely available" reflects RDAP only; premium, reserved,
  and restricted names can still be unbuyable. See the RDAP note above.
- RDAP coverage is uneven. gTLDs are well covered; some ccTLDs still publish no RDAP server and
  come back as `Unsupported`.
- In-memory, single-process cache. No shared/persistent cache; each server instance caches on
  its own, and restarts clear it.
- 100 inputs per request by design, to stay polite and responsive.
- Not a hardened multi-tenant service. It's a self-hosted tool: no auth, no per-user rate
  limiting. Run it somewhere you trust.

## Roadmap

- Optional registrar availability/pricing provider implementing the existing
  `registrarAvailability` interface (turn "likely available" into "available for $X").
- Persistent / shared caching (e.g. Redis) for multi-instance deployments.
- Env-configurable concurrency and timeouts.
- File import (upload a `.txt`/`.csv` of domains) and larger batch sizes with pagination.
- Saved lists & re-checks to watch a set of domains over time.
- Dark mode.
