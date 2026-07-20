# agent-test

Experimental scaffold for a private company **agent operations system**: local AI (Ollama / Macs) for confidential work, Railway as a thin connected plane for email/calendar/meeting tools, and a Windows-first Tauri desktop simulator so development does not wait on hardware.

> Temporary product label: **Agent Test**. Rename when identity is settled.

## Docs

- **[PLAN.md](./PLAN.md)** — architecture, privacy boundary, phases, Wednesday session goals, and build backlog.

## Status

Plan only. Implementation starts with **Phase 0.1: Windows Simulation Lab** (mocks, permissions, Action Bus, eval suite).

## Core idea

```text
Cloud coordinates actions  ·  Local infrastructure understands confidential data
One shared runtime         ·  Multiple isolated agent identities
AI proposes → human approves → AI executes  (until narrowly proven safe)
```
