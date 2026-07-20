# Downloading Agent Test (.exe / .msi / .app)

Windows and macOS installers are built by GitHub Actions on every push to this branch.

## Windows (what you want to test)

1. Open the repo on GitHub → **Actions**
2. Open the latest **Windows EXE (NSIS)** workflow run
3. Download the artifact **`Agent-Test-Windows`**
4. Unzip it — you should see something like:
   - `Agent Test_0.1.0_x64-setup.exe` (NSIS installer — preferred for quick testing)
   - `Agent Test_0.1.0_x64_en-US.msi` (MSI)

5. Run the **setup.exe**, install for the current user, launch **Agent Test**

The app starts in **Simulation Mode** (no Google / Ollama / Railway required).

### First-run demo

1. **Inbox** → open Robert’s email → **Ask Agent**
2. On Home → **Approve** the proposed Thursday meeting
3. Check **Calendar** for the event + mock Zoom link
4. **Evaluations** → **Run evaluation suite** (expect 13/13)

## macOS

Same flow under the **macOS app** workflow → artifact `Agent-Test-macOS`.

Unsigned builds may need: System Settings → Privacy & Security → Open Anyway.

## Build locally (Windows machine)

```bash
pnpm install
pnpm --filter @agent-test/desktop tauri:build:windows
```

Outputs land in:

`apps/desktop/src-tauri/target/release/bundle/nsis/`  
`apps/desktop/src-tauri/target/release/bundle/msi/`

## Browser-only (no installer)

```bash
pnpm install
pnpm dev
```

Opens the same UI at http://localhost:5173
