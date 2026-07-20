# Next steps

## Done

- **0.1** Simulation lab + Windows NSIS/MSI (`.exe`) via GitHub Actions
- **0.2 (this iteration)** Private-plane intelligence:
  - Real CSV finance parser + margin/client-hours analysis
  - Local document keyword indexer + search UI
  - Ollama provider adapter + ModelRouter (confidential → local only)
  - Settings page (provider / Ollama probe / gateway probe)
  - Richer Railway gateway (`/tools`, `/cron`, usage cap)

## Build next

### 0.3 — Connected Plane (real test accounts)

1. Google OAuth for a **test** Workspace / Gmail + Calendar
2. Implement `GoogleCalendarTool` / `GmailTool` behind existing interfaces
3. Postgres on Railway for action log + tasks (ops metadata only)
4. Wire desktop “Connected” toggle to live gateway URL
5. Keep approval ladder at Level 1 for all external sends

### 0.4 — Mac cutover (Wed session)

1. Inventory Mac RAM / chip; install Ollama on Mac 1
2. Point Settings → Ollama URL at Mac 1 LAN address
3. USB volume adapter on macOS
4. Same `.app` from macOS Actions artifact

### 0.5 — Pilot

1. Shadow mode on real inbox traffic
2. Master company calendar
3. Narrow Level-2 auto-send categories only after eval suite stays green

## How to run now

```bash
pnpm install
pnpm test && pnpm eval
pnpm dev          # UI
pnpm dev:web      # gateway :8080
```

Windows installer: [docs/DOWNLOAD.md](./DOWNLOAD.md)
