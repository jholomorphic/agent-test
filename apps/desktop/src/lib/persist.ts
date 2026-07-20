/** Persist a lightweight UI/runtime snapshot for the desktop app. */
import type { AgentRuntime } from "@agent-test/runtime";

const KEY = "agent-test-activity-cache";

export function cacheActivity(runtime: AgentRuntime) {
  try {
    const snap = runtime.snapshot();
    localStorage.setItem(
      KEY,
      JSON.stringify({
        activity: snap.activity.slice(0, 30),
        proposalCount: snap.proposals.length,
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    /* ignore quota */
  }
}

export function readActivityCache(): {
  activity: Array<{ time: string; agent: string; text: string }>;
  savedAt?: string;
} | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
