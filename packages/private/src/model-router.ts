import { DataClassification, type LLMProvider } from "@agent-test/contracts";

/**
 * Routes model calls by data classification.
 * Confidential/Restricted → local only (never cloud).
 */
export class ModelRouter implements LLMProvider {
  constructor(
    private local: LLMProvider,
    private cloud?: LLMProvider
  ) {}

  async complete(request: {
    agentId: import("@agent-test/contracts").AgentId;
    system: string;
    input: string;
    context?: Record<string, unknown>;
  }) {
    const classification =
      (request.context?.classification as DataClassification | undefined) ??
      DataClassification.Internal;

    const mustLocal =
      classification === DataClassification.Confidential ||
      classification === DataClassification.Restricted;

    if (mustLocal || !this.cloud) {
      return this.local.complete(request);
    }
    return this.cloud.complete(request);
  }
}

export function classificationFromInput(input: string): DataClassification {
  const t = input.toLowerCase();
  if (t.includes("payroll") || t.includes("ssn") || t.includes("bank")) {
    return DataClassification.Restricted;
  }
  if (
    t.includes("financial") ||
    t.includes("profit") ||
    t.includes("margin") ||
    t.includes("revenue")
  ) {
    return DataClassification.Confidential;
  }
  return DataClassification.Internal;
}
