# agent-test

Experimental scaffold for a private company **agent operations system**: local AI for confidential work, Railway as a thin connected plane, and a Windows-first simulation lab so development does not wait on Macs.

> Temporary product label: **Agent Test**

## Quick start

```bash
pnpm install
pnpm test          # scenario + privacy-boundary suite
pnpm eval          # printable evaluation board
pnpm dev           # ops console at http://localhost:5173
pnpm dev:web       # Connected Plane gateway at http://localhost:8080
```

**Windows `.exe`:** see **[docs/DOWNLOAD.md](./docs/DOWNLOAD.md)** — GitHub Actions builds NSIS/MSI on every push.  
**Roadmap:** **[docs/NEXT_STEPS.md](./docs/NEXT_STEPS.md)**

## Layout

```text
apps/desktop   Vite + React ops console (Tauri shell scaffolded)
apps/web       Railway Agent Gateway stub
packages/      contracts · permissions · mocks · runtime · agents · ui
scenarios/     JSON fixtures
tests/         Vitest agent evaluations
fixtures/      sample docs / USB / financials
```

## Architecture

See **[PLAN.md](./PLAN.md)**.

```text
Private Plane (local)     Action Bus      Connected Plane (Railway)
Ollama · finance · RAG  ←──────────────→  email · calendar · meet tools
```

Phase **0.1** ships fully in **Simulation Mode** with MockLLM / MockEmail / MockCalendar. Swap adapters later without redesigning the app.

## Demo loop

1. Open the console → Inbox → **Ask Agent** on Robert’s email  
2. Approve the proposed Thursday meeting  
3. Calendar gains event + mock Zoom URL; confirmation lands in Drafts  
4. Finance → run analysis → Connected Plane receives only `review_required` metadata
