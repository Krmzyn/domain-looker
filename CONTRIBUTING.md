# Contributing to Domain Looker

Thanks for your interest in improving Domain Looker! This is a small, focused
project, so the workflow is deliberately lightweight.

## Getting started

```bash
npm install
npm run dev        # web on http://127.0.0.1:5173, API on http://127.0.0.1:3001
```

No API keys or accounts are required. If you don't want to hit live RDAP
servers while developing, use demo mode:

```bash
npm run dev:demo   # API returns simulated, offline results
```

## Before you open a pull request

Please make sure the same checks that run in CI pass locally:

```bash
npm run typecheck  # TypeScript, frontend + backend
npm test           # Vitest unit/integration tests
npm run build      # production build of both frontend and backend
```

## Guidelines

- **Keep it typed.** The project runs in `strict` mode; avoid `any` and prefer
  explicit types at module boundaries.
- **Add or update tests** for behavior changes. Frontend tests live in
  `src/__tests__`, backend tests in `server/__tests__`.
- **Match the existing style.** Two-space indentation, no default exports for
  utilities, small focused modules.
- **Don't commit secrets or personal data.** There are none in this repo today,
  and there shouldn't be any tomorrow. Local config belongs in `.env` (ignored).
- **Keep RDAP behavior honest.** A "likely available" result is a pre-check, not
  a guarantee, so keep UI copy and docs accurate about that distinction.

## Reporting bugs and ideas

Open a GitHub issue with steps to reproduce (for bugs) or a short description of
the use case (for features). Small, well-scoped pull requests are welcome.
