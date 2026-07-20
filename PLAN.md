# Agent Test — Engineering Plan

**Repo:** `agent-test` (experimental infrastructure; product name TBD)  
**Desktop product label (temporary):** Agent Test  
**Target session:** Wednesday, July 22, 2026 · 11:30 a.m.  
**Principle:** One shared infrastructure, multiple isolated agent identities. Cloud coordinates actions; local infrastructure understands confidential data.

**Status (2026-07-20):** Phase **0.1 Simulation Lab is implemented**. Windows **NSIS `.exe` / MSI** and macOS app bundles are produced by GitHub Actions (`Windows EXE (NSIS)` workflow → artifact `Agent-Test-Windows`). See `docs/DOWNLOAD.md`.

---

## 1. What we are building

A small internal **AI operations system** (not a chatbot): company data → agent context → reasoning → approval/automation → email, calendar, files, contacts.

### Agents (V1 identities)

| Agent | Job |
| --- | --- |
| **Admin / Scheduling** | Email, calendar, Zoom/Meet, reminders, master calendar, recurring admin tasks |
| **Finance** | Spreadsheets/PDFs → profitability, margins, anomalies, management summaries |
| **Documents** | Ingest PDFs/DOCX/XLSX/scans → searchable knowledge base / binder indexes |
| **CRM / Relationships** | Orgs, contacts, interactions, follow-ups; account isolation (e.g. Melanie vs company) |
| **Company / Router** | Shared context, agent-to-agent messages, agenda items, non-sensitive coordination |

Personal agents (Melanie, other executives) are **permissioned identities** over the same runtime—not separate model processes.

### Non-goals for V1

- Full CRM UI (Twenty, etc.)
- Level-3 autonomous email sending for everything
- Running large LLMs on Railway
- Shipping a finished branded product

---

## 2. Architecture (locked decisions)

```text
                    PUBLIC INTERNET
                         │
             ┌───────────▼───────────┐
             │       RAILWAY         │  Connected Plane
             │  Agent Gateway        │  ~$5–20/mo Hobby + hard usage limit
             │  Webhooks / cron      │
             │  Postgres (ops meta)  │
             │  Email/Cal/Meet tools │
             └───────────┬───────────┘
                         │  Action Bus (typed, audited, sanitized)
                ┌────────▼────────┐
                │  MAC #1         │  Private Plane
                │  AI SERVER      │  Ollama · agents · RAG · finance
                └────────┬────────┘
                         │ LAN
                ┌────────▼────────┐
                │  MAC #2         │  Ops console
                │  Dashboard      │  uploads · USB · approvals
                └─────────────────┘
```

| Layer | Owns | Does **not** own |
| --- | --- | --- |
| **Connected Plane (Railway)** | Email/calendar/meeting APIs, webhooks, cron, approval queue metadata, sanitized action requests | Raw financials, payroll, client docs, confidential RAG, credentials |
| **Private Plane (Macs / local desktop)** | Ollama inference, document/finance processing, private memory, local DBs | Public webhook exposure |
| **Action Bus** | Typed events (`ScheduleMeeting`, `SendApprovedEmail`, `FinancialReviewRequired`, …) with permission checks + audit | Free-form agent chat across planes |

**Approval ladder (email & external actions)**

1. AI drafts → human sends  
2. Auto-send for approved routine categories  
3. Full workflow autonomy for narrow, tested paths only  

Default forever for sensitive actions: **AI proposes → human approves → AI executes**.

---

## 3. Data classification (enforced in software, not prompts)

| Class | Examples | Rule |
| --- | --- | --- |
| **Public** | Public site copy | Cloud or local OK |
| **Internal** | Procedures, general schedules | Prefer local; limited cloud |
| **Confidential** | Client docs, financials | **Local only** |
| **Restricted** | Credentials, payroll, banking, personal records | **Local + explicit auth** |

`DataClassifier` → `PolicyEngine` → `ModelRouter` runs **before** any model call. Confidential/restricted never route to cloud LLMs. Railway may receive metadata only (e.g. `review_required`, not revenue figures).

---

## 4. Two-Mac operating model (Wednesday inventory)

### Mac 1 — Always-on AI server

Ollama (reasoning + fast + embeddings), agent runtime, vector/doc store, scheduled jobs, file ingestion, local APIs.

### Mac 2 — Human ops console

Email/calendar/Calendly/Zoom UI surface, dashboard, file/USB ingestion, approvals; optional failover if Mac 1 is down.

**Inventory checklist (bring to session):** model/year, chip, **RAM** (critical), storage, macOS, network, which machine stays on, who controls each Mac.

**Account map (table to fill Wednesday):**

| Person/System | Email | Calendar | Contacts | Files | Permissions |
| --- | --- | --- | --- | --- | --- |
| Melanie | | | | private/shared | owner |
| Executive 2 | | | | | owner |
| Company | shared | master | CRM | shared | org |
| Finance | restricted | review dates | vendors | financials | restricted |

**Bring (copies only):** admin creds, Apple IDs, Google/Microsoft, calendars, Zoom, Calendly, sample contacts, sample emails, 5–10 docs, one financial spreadsheet + current manual profitability method, USB workflow example.

---

## 5. Repository layout

```text
agent-test/
├── apps/
│   ├── desktop/          # PRIMARY — Tauri 2 (Windows first → macOS)
│   ├── web/              # Railway control plane (Next.js + Postgres)
│   └── worker/           # Background jobs (later)
├── packages/
│   ├── contracts/        # Shared types, Action Bus events
│   ├── agents/           # Identities, system prompts, namespaces
│   ├── tools/            # Tool interfaces + adapters
│   ├── workflows/        # Declarative automation graphs
│   ├── permissions/      # Policy engine
│   ├── database/         # Schema / migrations helpers
│   └── ui/               # Shared React UI
├── private/              # Private-plane modules (ollama, finance, rag)
├── connected/            # Connected-plane adapters (email, cal, meet)
├── mocks/                # MockLLM, MockEmail, MockCalendar, …
├── scenarios/            # Deterministic eval fixtures (JSON)
├── tests/                # Unit, integration, privacy-boundary, agent-evals
└── .github/workflows/    # test → Windows build → macOS build → artifacts
```

**Critical abstraction:** agents call tool **interfaces**; adapters swap without redesigning the app.

```ts
interface CalendarTool {
  getAvailability(...): Promise<Availability>;
  createEvent(...): Promise<Event>;
  updateEvent(...): Promise<Event>;
}
// MockCalendarTool | GoogleCalendarTool | AppleCalendarTool
```

Same pattern for `EmailTool`, `ContactsTool`, `LLMProvider`, `DocumentStore`, `TaskStore`, `MeetingProvider`, filesystem/USB.

**Desktop strategy:** one React UI → Tauri Windows (dev/test now) → same UI on macOS Wednesday → optional Railway web dashboard sharing `packages/ui`.

**Offline-first:** desktop GUI, mocks, local file processing, agent tests, and audit logs work **without** Railway. Railway adds connectivity; it is not a hard dependency for local simulation.

---

## 6. Core data model (Postgres locally + Railway ops DB)

Minimum entities:

- `organizations`, `contacts`, `interactions`
- `tasks` (owner, due, source, status, priority, related person/company/document, next action)
- `meetings` / calendar event refs
- `documents` + classifications + binder indexes
- `financial_runs` / report metadata (raw sheets stay private)
- `audit_events` (input → intent → tool request → permission decision → result)
- `action_bus_messages` (cross-plane typed events)

**Master Company Calendar** is source of truth for company events; personal calendars stay separate; Calendly is an external scheduling UI only. Permissions gate which agent may modify which calendar.

**Memory stack (do not rely on model “memory” alone):** documents + structured DB + calendar + task queue.

---

## 7. GUI (operations console, not ChatGPT clone)

Feel: Linear + Notion + Slack + ops dashboard. Temporary brand: **Agent Test**.

### Screens (v0.1)

1. **Home / Today** — approvals queue, upcoming meetings, open tasks, activity feed, command bar  
2. **Agent cards** — identity, model, access matrix, execute permissions, recent actions, Private vs Connected badge  
3. **Agent graph** — edges show allowed message types (e.g. Finance → Company: `profitability_alert` OK; raw bank data denied)  
4. **Inbox / Calendar / Tasks / Contacts / Documents / Finance** — mock-backed first  
5. **Automation Studio** — visual WHEN → IF → THEN (Zapier-simple); steps toggleable  
6. **Developer → Agent Playground** — observable decision trace (intent, tools, permissions, result)—not private CoT  
7. **Developer → Evaluations** — scenario suite pass/fail board  

Permanent mode badge: `● SIMULATION MODE` until real adapters are live.

---

## 8. Phased roadmap

### Phase 0.1 — Windows Simulation Lab (build first)

- Tauri Windows app + seeded fictional company (Melanie, two Roberts, Jennifer, Atlanta orgs, emails, calendar, docs, tasks)
- Mock agents + tool registry + permission engine + activity/audit log
- Fake inbox → Ask Agent → propose workflow → Approve
- File drop + simulated USB folder (`C:\CohesionTestUSB\` or `./fixtures/usb/`)
- Scenario runner + privacy-boundary tests (no confidential payload in simulated Railway/email/logs)
- GitHub CI: lint → unit/scenario tests → Windows NSIS installer artifact

**Exit criteria:** one vertical demo — *email request → agent → propose times → approve → mock calendar + Zoom + confirmation + CRM + reminder* — fully deterministic with `MockLLM`.

### Phase 0.2 — Local intelligence on Windows

- Real XLSX/CSV/PDF ingest (local)
- Optional local Ollama on Windows
- Document indexing + finance analysis path stays Private Plane

### Phase 0.3 — Railway Connected Plane

- Next.js gateway + Postgres + hard usage limit
- Tool surface: email, calendar, meetings, contacts, tasks (permission-checked `POST /agent/action`)
- Swap mocks for **test** Gmail/Calendar accounts only
- Cron for reminders/overdue (Railway min cadence is fine for business automation)

### Phase 0.4 — macOS / two-Mac cutover (Wednesday+)

- Same Tauri app on Apple Silicon
- Mac 1: Ollama + private stores; Mac 2: ops console
- USB/volumes adapters; Keychain later
- Hardware inventory + account/permission map completed in session

### Phase 0.5 — Company pilot

- Real Melanie / Admin / Finance / Documents / Company agents
- Shadow mode on real traffic before Level-2 auto-send
- Master calendar + task DB live
- Expand only after eval suite stays green

### Wednesday session objective (single vertical slice)

```text
Email → (mock or Railway gateway) → Local agent → Calendar tool → Event + Meet link → Confirmation → Reminder
```

Plus: hardware inventory, account map, master calendar + data boundaries agreed. Prefer **not** installing a dozen tools before the operating model is clear.

---

## 9. First three automations (priority order)

1. **Meeting Agent** — email → resolve contact → calendars → propose → approve → event + link → confirm → remind → CRM note  
2. **Document Agent** — drop file → classify → index → summarize → searchable  
3. **Finance Agent** — upload sheet → normalize → compare history → profitability → local report; Railway gets `review_required` metadata only  

Agent-to-agent example: Finance finding → Company Agent alert → Admin adds agenda on master calendar (structured messages, not shared god-memory).

---

## 10. Evaluation & security suite (ship with v0.1)

| ID | Scenario | Expected |
| --- | --- | --- |
| A | Schedule Melanie + Robert Thursday afternoon | Correct contact, no double-book, event + URL + confirm |
| B | Ambiguous “Robert” (two matches) | **No execute**; disambiguate |
| C | Cross-permission reads (Finance ↔ Melanie email / payroll) | **DENIED** |
| D | Prompt injection in PDF/email | Treat as untrusted data; **no tools** |
| E | Ollama offline | Queue; no duplicate sends |
| F | Railway offline | Local work continues; outbound queue; execute once on reconnect |
| G | Privacy boundary | Confidential fixtures never appear in Connected Plane payloads, logs, telemetry |

**Shadow mode:** run real/sim inputs through agents; log proposed tool calls without executing; score correctness before enabling execution.

---

## 11. CI / deployment targets

```text
push → core tests (Linux) → Windows build (NSIS setup.exe) → macOS build (.app) → artifacts
```

Railway early: `web` + Postgres only. Add worker/cron when real automation starts. Set **hard usage limit** day one.

Investigate later (prototype only, do not commit company infra to them on day one): Railway **Coworker**, **Keeper**, **Twenty** templates.

---

## 12. Immediate build backlog (this repo, before Wednesday)

Ordered work for the scaffold:

1. Monorepo + `packages/contracts` (Action Bus event types, data classification enums, tool interfaces)
2. `packages/permissions` + policy tests
3. `mocks/*` + seeded demo company fixtures
4. `packages/agents` + MockLLM deterministic tool-call responses
5. `apps/desktop` Tauri shell: Home, Approvals, Inbox, Agent cards, command bar, Simulation badge
6. Scenario JSON + eval runner (A–G above)
7. Privacy-boundary test harness
8. GitHub Actions: test + Windows build
9. Stub `apps/web` for Railway (health + action bus receive stub)
10. Docs: this plan, Wednesday checklist, adapter swap guide (`Mock*` → real)

---

## 13. Success definition

**Before Wednesday:** clone → install Windows simulator → run eval suite green → demo scheduling loop in Simulation Mode.

**On Wednesday:** inventory Macs + fill account map → prove same loop against one real calendar/email **or** keep mocks and only wire Ollama if RAM allows → leave with architecture and one working path, not a pile of half-configured tools.

**After:** swap adapters one at a time; never redesign the application to “add AI.”
