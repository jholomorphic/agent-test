import { useCallback, useMemo, useState } from "react";
import type { AgentId, AgentRunResult, ProposedAction } from "@agent-test/contracts";
import { AgentRuntime } from "@agent-test/runtime";
import { pickAgentForInput } from "@agent-test/agents";

type NavId =
  | "home"
  | "agents"
  | "inbox"
  | "calendar"
  | "tasks"
  | "contacts"
  | "documents"
  | "finance"
  | "graph"
  | "studio"
  | "playground"
  | "evals";

const NAV: { id: NavId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "agents", label: "Agents" },
  { id: "inbox", label: "Inbox" },
  { id: "calendar", label: "Calendar" },
  { id: "tasks", label: "Tasks" },
  { id: "contacts", label: "Contacts" },
  { id: "documents", label: "Documents" },
  { id: "finance", label: "Finance" },
  { id: "graph", label: "Agent Graph" },
  { id: "studio", label: "Automation Studio" },
  { id: "playground", label: "Playground" },
  { id: "evals", label: "Evaluations" },
];

function loadPrefs() {
  try {
    const raw = localStorage.getItem("agent-test-prefs");
    if (!raw) return { shadow: false, llmOnline: true, connectedOnline: true };
    return JSON.parse(raw) as {
      shadow: boolean;
      llmOnline: boolean;
      connectedOnline: boolean;
    };
  } catch {
    return { shadow: false, llmOnline: true, connectedOnline: true };
  }
}

function createRuntime(prefs = loadPrefs()) {
  return new AgentRuntime({
    mode: "simulation",
    shadow: prefs.shadow,
    llmOnline: prefs.llmOnline,
    connectedOnline: prefs.connectedOnline,
  });
}

export function App() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [runtime, setRuntime] = useState(() => createRuntime(prefs));
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((n) => n + 1);

  const [nav, setNav] = useState<NavId>("home");
  const [command, setCommand] = useState(
    "Schedule Melanie with Robert Smith Thursday afternoon about the latest numbers"
  );
  const [selectedAgent, setSelectedAgent] = useState<AgentId>("admin");
  const [lastRun, setLastRun] = useState<AgentRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [evalResults, setEvalResults] = useState<
    Array<{ name: string; pass: boolean; detail: string }>
  >([]);

  const applyPrefs = (next: typeof prefs) => {
    setPrefs(next);
    localStorage.setItem("agent-test-prefs", JSON.stringify(next));
    const rt = createRuntime(next);
    setRuntime(rt);
    setLastRun(null);
    setEvalResults([]);
    setVersion((n) => n + 1);
  };
  const snap = useMemo(() => runtime.snapshot(), [runtime, version]);

  const runCommand = useCallback(async () => {
    if (!command.trim()) return;
    setBusy(true);
    try {
      const agent = pickAgentForInput(command);
      setSelectedAgent(agent);
      const result = await runtime.run(agent, command);
      setLastRun(result);
      if (result.proposedAction) setNav("home");
      refresh();
    } finally {
      setBusy(false);
    }
  }, [command, runtime]);

  const askOnEmail = async (emailBody: string, subject: string) => {
    setBusy(true);
    try {
      const input = `${subject}\n\n${emailBody}`;
      const result = await runtime.run("admin", input);
      setLastRun(result);
      setSelectedAgent("admin");
      setNav("home");
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const approve = async (p: ProposedAction) => {
    await runtime.approve(p.id);
    const { cacheActivity } = await import("./lib/persist");
    cacheActivity(runtime);
    refresh();
  };

  const reject = async (p: ProposedAction) => {
    await runtime.reject(p.id);
    refresh();
  };

  const onDropFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const payloads = [];
    for (const file of Array.from(files)) {
      const content = await file.text().catch(() => undefined);
      payloads.push({
        name: file.name,
        path: `inbox/${file.name}`,
        content,
      });
    }
    await runtime.importPaths(payloads);
    setNav("documents");
    refresh();
  };

  const runEvals = async () => {
    const { runAllEvals } = await import("./lib/evals");
    const results = await runAllEvals();
    setEvalResults(results);
    setNav("evals");
  };

  const pending = snap.proposals.filter((p) => p.status === "pending");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Agent Test</div>
        <div className="topbar-controls">
          <label className="toggle">
            <input
              type="checkbox"
              checked={prefs.shadow}
              onChange={(e) => applyPrefs({ ...prefs, shadow: e.target.checked })}
            />
            Shadow
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={prefs.llmOnline}
              onChange={(e) => applyPrefs({ ...prefs, llmOnline: e.target.checked })}
            />
            LLM
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={prefs.connectedOnline}
              onChange={(e) =>
                applyPrefs({ ...prefs, connectedOnline: e.target.checked })
              }
            />
            Connected
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const rt = createRuntime(prefs);
              setRuntime(rt);
              setLastRun(null);
              setEvalResults([]);
              refresh();
            }}
          >
            Reset demo
          </button>
          <div className="badge">
            {prefs.shadow ? "Shadow Mode" : "Simulation Mode"} · System Healthy
          </div>
        </div>
      </header>

      <aside className="nav">
        {NAV.slice(0, 8).map((item) => (
          <button
            key={item.id}
            className={nav === item.id ? "active" : ""}
            onClick={() => setNav(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
        <div className="nav-section">Agents</div>
        {snap.agents.map((a) => (
          <button
            key={a.agentId}
            type="button"
            className={selectedAgent === a.agentId && nav === "agents" ? "active" : ""}
            onClick={() => {
              setSelectedAgent(a.agentId);
              setNav("agents");
            }}
          >
            <span className="agent-dot" />
            {a.label.replace(" Agent", "")}
          </button>
        ))}
        <div className="nav-section">Developer</div>
        {NAV.slice(8).map((item) => (
          <button
            key={item.id}
            className={nav === item.id ? "active" : ""}
            onClick={() => setNav(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </aside>

      <main className="main">
        {nav === "home" && (
          <>
            <h1>Today / Operations</h1>
            <p className="muted">
              Acme Advisory simulation — approve actions, then agents execute through
              mock tools.
            </p>
            <div className="grid-stats">
              <div className="stat">
                <strong>{snap.events.length}</strong>
                Meetings / events
              </div>
              <div className="stat">
                <strong>{snap.tasks.filter((t) => t.status !== "done").length}</strong>
                Open tasks
              </div>
              <div className="stat">
                <strong>{pending.length}</strong>
                Needs approval
              </div>
            </div>

            <section className="panel">
              <h2>Needs approval</h2>
              {pending.length === 0 && (
                <p className="muted">No pending proposals. Ask the agent from the command bar.</p>
              )}
              {pending.map((p) => (
                <div className="proposal" key={p.id}>
                  <div>
                    <strong>{p.title}</strong>
                    <p className="muted" style={{ whiteSpace: "pre-wrap", margin: "0.35rem 0" }}>
                      {p.description}
                    </p>
                    <div>
                      {p.workflowSteps.map((s) => (
                        <span className="tag" key={s.id}>
                          {s.status === "done" ? "✓" : "○"} {s.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="actions">
                    <button className="btn" type="button" onClick={() => setLastRun({
                      agentId: p.agentId,
                      input: p.title,
                      trace: [],
                      proposedAction: p,
                    })}>
                      Review
                    </button>
                    <button className="btn primary" type="button" onClick={() => approve(p)}>
                      Approve
                    </button>
                    <button className="btn danger" type="button" onClick={() => reject(p)}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </section>

            <section className="panel">
              <h2>Upcoming</h2>
              {snap.events.slice(0, 5).map((e) => (
                <div className="list-item" key={e.id}>
                  <strong>{e.title}</strong>
                  <div className="muted">
                    {new Date(e.start).toUTCString()} · {e.calendarId}
                    {e.meetingUrl ? ` · ${e.meetingUrl}` : ""}
                  </div>
                </div>
              ))}
            </section>

            {lastRun && (
              <section className="panel">
                <h2>Last agent run</h2>
                <p>
                  <span className="tag">{lastRun.agentId}</span>
                  {lastRun.intent && <span className="tag">{lastRun.intent}</span>}
                  {lastRun.denied && <span className="tag danger">DENIED</span>}
                </p>
                <div className="trace">
                  {lastRun.trace
                    .map((t) => `${t.step}. [${t.kind}] ${t.message}`)
                    .join("\n")}
                </div>
              </section>
            )}
          </>
        )}

        {nav === "agents" && (
          <>
            <h1>Agents</h1>
            {snap.agents
              .filter((a) => a.agentId === selectedAgent)
              .map((a) => (
                <div className="agent-card" key={a.agentId}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <h2>{a.label}</h2>
                    <span className="tag">{a.online ? "ONLINE" : "OFFLINE"}</span>
                  </div>
                  <p>
                    <span className={`tag ${a.plane === "private" ? "private" : ""}`}>
                      {a.plane === "private" ? "PRIVATE EXECUTION" : "CONNECTED EXECUTION"}
                    </span>
                  </p>
                  <p className="muted">Model · {a.model}</p>
                  <h3>Can access</h3>
                  <ul>
                    {a.canAccess.map((x) => (
                      <li key={x}>✓ {x}</li>
                    ))}
                    {a.cannotAccess.map((x) => (
                      <li key={x}>✗ {x}</li>
                    ))}
                  </ul>
                  <h3>Can execute</h3>
                  <ul>
                    {a.canExecute.map((x) => (
                      <li key={x}>✓ {x}</li>
                    ))}
                    {a.requiresApproval.map((x) => (
                      <li key={x}>⚠ {x} — Approval Required</li>
                    ))}
                  </ul>
                </div>
              ))}
            <div className="panel">
              <h3>All agents</h3>
              {snap.agents.map((a) => (
                <button
                  key={a.agentId}
                  className="btn"
                  style={{ marginRight: 8, marginBottom: 8 }}
                  type="button"
                  onClick={() => setSelectedAgent(a.agentId)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </>
        )}

        {nav === "inbox" && (
          <>
            <h1>Inbox</h1>
            {snap.emails
              .filter((e) => e.folder === "inbox")
              .map((e) => (
                <div className="panel" key={e.id}>
                  <strong>{e.subject}</strong>
                  <div className="muted">From: {e.from}</div>
                  <p style={{ whiteSpace: "pre-wrap" }}>{e.body}</p>
                  <button
                    className="btn primary"
                    type="button"
                    disabled={busy}
                    onClick={() => askOnEmail(e.body, e.subject)}
                  >
                    Ask Agent
                  </button>
                </div>
              ))}
            <h2>Drafts / Sent</h2>
            {snap.emails
              .filter((e) => e.folder !== "inbox")
              .map((e) => (
                <div className="list-item" key={e.id}>
                  <span className="tag">{e.folder}</span>
                  <strong>{e.subject}</strong>
                  <div className="muted">{e.body.slice(0, 120)}…</div>
                </div>
              ))}
          </>
        )}

        {nav === "calendar" && (
          <>
            <h1>Calendar</h1>
            <p className="muted">Master company calendar + Melanie calendar (mock).</p>
            {snap.events.map((e) => (
              <div className="list-item" key={e.id}>
                <span className="tag">{e.calendarId}</span>
                <strong>{e.title}</strong>
                <div className="muted">
                  {e.start} → {e.end}
                </div>
                {e.meetingUrl && <div className="muted">{e.meetingUrl}</div>}
              </div>
            ))}
          </>
        )}

        {nav === "tasks" && (
          <>
            <h1>Tasks</h1>
            {snap.tasks.map((t) => (
              <div className="list-item" key={t.id}>
                <span className="tag">{t.status}</span>
                <span className="tag warn">{t.priority}</span>
                <strong>{t.title}</strong>
                <div className="muted">
                  Owner: {t.owner}
                  {t.dueDate ? ` · Due ${t.dueDate}` : ""}
                </div>
              </div>
            ))}
          </>
        )}

        {nav === "contacts" && (
          <>
            <h1>Contacts & Organizations</h1>
            {snap.organizations.map((o) => (
              <div className="panel" key={o.id}>
                <h2>{o.name}</h2>
                <p className="muted">{o.location}</p>
                {snap.contacts
                  .filter((c) => c.organizationId === o.id)
                  .map((c) => (
                    <div className="list-item" key={c.id}>
                      <strong>{c.name}</strong> · {c.role} · {c.email}
                    </div>
                  ))}
              </div>
            ))}
          </>
        )}

        {nav === "documents" && (
          <>
            <h1>Documents</h1>
            <div
              className="dropzone"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("active");
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove("active")}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("active");
                void onDropFiles(e.dataTransfer.files);
              }}
            >
              <h2>Drop files here</h2>
              <p className="muted">PDF · XLSX · CSV · DOCX — stays in the Private Plane</p>
              <input
                type="file"
                multiple
                onChange={(e) => void onDropFiles(e.target.files)}
              />
            </div>
            <div style={{ marginTop: "1rem" }}>
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  await runtime.importPaths([
                    {
                      name: "usb-financials.xlsx",
                      path: "fixtures/usb/financials.xlsx",
                      content: "Service margins Q2 financial spreadsheet",
                    },
                    {
                      name: "clients.csv",
                      path: "fixtures/usb/clients.csv",
                      content: "name,org\nJennifer,Atlanta Ventures",
                    },
                  ]);
                  refresh();
                }}
              >
                Simulate USB import
              </button>
            </div>
            {snap.documents.map((d) => (
              <div className="list-item" key={d.id}>
                <span className="tag private">{d.classification}</span>
                <strong>{d.name}</strong>
                <div className="muted">{d.summary}</div>
              </div>
            ))}
          </>
        )}

        {nav === "finance" && (
          <>
            <h1>Finance</h1>
            <p className="muted">Private Plane only — Connected Plane gets metadata alerts.</p>
            <button
              className="btn primary"
              type="button"
              onClick={async () => {
                const result = await runtime.run("finance", "Analyze Q2 financials and flag margin changes");
                setLastRun(result);
                refresh();
              }}
            >
              Run Finance Agent on Q2 spreadsheet
            </button>
            {snap.findings.map((f) => (
              <div className="panel" key={f.id}>
                <span className={`tag ${f.severity === "critical" ? "danger" : "warn"}`}>
                  {f.severity}
                </span>
                <strong>{f.summary}</strong>
                <div className="muted">
                  report {f.reportId}
                  {f.reviewRequired ? " · review required" : ""}
                </div>
              </div>
            ))}
            <h3>Connected Plane messages (sanitized)</h3>
            <div className="trace">{JSON.stringify(snap.connectedMessages, null, 2)}</div>
          </>
        )}

        {nav === "graph" && (
          <>
            <h1>Agent Graph</h1>
            <div className="graph">
              <div className="node company">Company Agent</div>
              <div className="edge-note">shared context / tasks · typed Action Bus only</div>
              <div className="graph-row">
                <div className="node">Melanie</div>
                <div className="node">Finance</div>
                <div className="node">Documents</div>
                <div className="node">Admin</div>
              </div>
              <div className="panel edge-note">
                <strong>Finance → Company</strong>
                <p>✓ financial_summary · profitability_alert · review_required</p>
                <p>✗ raw_bank_data · credentials · payroll figures</p>
              </div>
            </div>
          </>
        )}

        {nav === "studio" && (
          <>
            <h1>Automation Studio</h1>
            <div className="panel">
              <p>
                <strong>WHEN</strong> New email received
              </p>
              <p>
                <strong>IF</strong> Message requests meeting
              </p>
              <p>
                <strong>THEN</strong>
              </p>
              <ol>
                <li>Ask Scheduling Agent</li>
                <li>Check calendar</li>
                <li>Propose available times</li>
                <li>Human approval</li>
                <li>Create event</li>
                <li>Generate meeting link</li>
                <li>Send confirmation (draft / Level 1)</li>
              </ol>
              <p className="muted">Visual toggles land in a later iteration — workflow is live via Ask Agent.</p>
            </div>
          </>
        )}

        {nav === "playground" && (
          <>
            <h1>Agent Playground</h1>
            <div className="panel">
              <label>
                Agent{" "}
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value as AgentId)}
                >
                  {snap.agents.map((a) => (
                    <option key={a.agentId} value={a.agentId}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                style={{ width: "100%", minHeight: 100, marginTop: 12 }}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
              />
              <div style={{ marginTop: 12 }}>
                <button className="btn primary" type="button" disabled={busy} onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await runtime.run(selectedAgent, command);
                    setLastRun(result);
                    refresh();
                  } finally {
                    setBusy(false);
                  }
                }}>
                  Run
                </button>
              </div>
              {lastRun && (
                <div className="trace" style={{ marginTop: 12 }}>
                  {lastRun.trace
                    .map((t) => `${t.step}. [${t.kind}] ${t.message}`)
                    .join("\n")}
                  {"\n\n"}
                  RESULT: {lastRun.denied ? "DENIED" : lastRun.needsDisambiguation ? "DISAMBIGUATE" : "OK"}
                </div>
              )}
            </div>
          </>
        )}

        {nav === "evals" && (
          <>
            <h1>Evaluations</h1>
            <button className="btn primary" type="button" onClick={() => void runEvals()}>
              Run evaluation suite
            </button>
            <div className="panel" style={{ marginTop: 12 }}>
              {evalResults.length === 0 && (
                <p className="muted">Run the suite to see scheduling, permission, security, and failure checks.</p>
              )}
              {evalResults.map((r) => (
                <div className="list-item" key={r.name}>
                  <span className={`tag ${r.pass ? "" : "danger"}`}>
                    {r.pass ? "PASS" : "FAIL"}
                  </span>
                  <strong>{r.name}</strong>
                  <div className="muted">{r.detail}</div>
                </div>
              ))}
              {evalResults.length > 0 && (
                <p>
                  <strong>
                    {evalResults.filter((r) => r.pass).length} / {evalResults.length} PASS
                  </strong>
                </p>
              )}
            </div>
          </>
        )}
      </main>

      <aside className="rail">
        <h3>Activity</h3>
        {snap.activity.length === 0 && (
          <p className="muted">Agent activity will show up here.</p>
        )}
        {snap.activity.slice(0, 20).map((a, i) => (
          <div className="activity-item" key={`${a.time}-${i}`}>
            <time>{new Date(a.time).toLocaleTimeString()}</time>
            <strong>{a.agent}</strong> {a.text}
          </div>
        ))}
      </aside>

      <footer className="command">
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void runCommand();
          }}
          placeholder='Ask Agent Test… "Schedule Melanie with Robert next week"'
          aria-label="Command"
        />
        <button type="button" disabled={busy} onClick={() => void runCommand()}>
          {busy ? "Running…" : "Ask"}
        </button>
      </footer>
    </div>
  );
}
