export {
  AGENT_CAPABILITIES,
  ActionBus,
  AgentRuntime,
  getRuntime,
  resetRuntime,
} from "@agent-test/runtime";
export type { RuntimeOptions, ConnectedPlaneSink } from "@agent-test/runtime";

import type { AgentId } from "@agent-test/contracts";

export function pickAgentForInput(input: string): AgentId {
  const lower = input.toLowerCase();
  if (
    lower.includes("financial") ||
    lower.includes("profit") ||
    lower.includes("margin") ||
    lower.includes("payroll")
  ) {
    return "finance";
  }
  if (
    lower.includes("document") ||
    lower.includes("binder") ||
    lower.includes("ingest") ||
    lower.includes("pdf")
  ) {
    return "documents";
  }
  if (lower.includes("schedule") || lower.includes("meet") || lower.includes("calendar")) {
    return "admin";
  }
  return "melanie";
}
