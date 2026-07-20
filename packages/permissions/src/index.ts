import {
  AgentId,
  DataClassification,
  Plane,
} from "@agent-test/contracts";

export type ResourceKind =
  | "email"
  | "calendar"
  | "contacts"
  | "documents"
  | "finance_raw"
  | "finance_summary"
  | "tasks"
  | "meetings"
  | "memory";

export interface PermissionRequest {
  agentId: AgentId;
  action: "read" | "write" | "execute" | "send_external";
  resource: ResourceKind;
  resourceOwner?: string; // e.g. "melanie", "company", "finance"
  classification?: DataClassification;
  targetPlane?: Plane;
}

export type PermissionDecision =
  | { decision: "allowed" }
  | { decision: "denied"; reason: string }
  | { decision: "approval_required"; reason: string };

/** Matrix: which agent may touch which resource/owner. */
const ACCESS: Record<
  AgentId,
  Partial<Record<ResourceKind, { owners: string[]; write?: boolean; sendExternal?: "never" | "approval" | "auto" }>>
> = {
  melanie: {
    email: { owners: ["melanie"], write: true, sendExternal: "approval" },
    calendar: { owners: ["melanie", "company"], write: true },
    contacts: { owners: ["company", "melanie"], write: true },
    documents: { owners: ["company", "melanie"], write: false },
    tasks: { owners: ["melanie", "company"], write: true },
    meetings: { owners: ["melanie", "company"], write: true },
    memory: { owners: ["melanie"], write: true },
    finance_summary: { owners: ["company"], write: false },
    finance_raw: { owners: [], write: false },
  },
  admin: {
    email: { owners: ["admin", "company"], write: true, sendExternal: "approval" },
    calendar: { owners: ["company", "melanie", "executive"], write: true },
    contacts: { owners: ["company"], write: true },
    documents: { owners: ["company"], write: false },
    tasks: { owners: ["company", "admin"], write: true },
    meetings: { owners: ["company"], write: true },
    memory: { owners: ["admin"], write: true },
    finance_summary: { owners: ["company"], write: false },
    finance_raw: { owners: [], write: false },
  },
  finance: {
    finance_raw: { owners: ["finance"], write: true },
    finance_summary: { owners: ["finance", "company"], write: true },
    documents: { owners: ["finance", "company"], write: false },
    contacts: { owners: ["company"], write: false },
    tasks: { owners: ["finance", "company"], write: true },
    calendar: { owners: ["company"], write: false },
    email: { owners: ["finance"], write: false, sendExternal: "never" },
    meetings: { owners: ["company"], write: false },
    memory: { owners: ["finance"], write: true },
  },
  documents: {
    documents: { owners: ["company", "documents"], write: true },
    contacts: { owners: ["company"], write: false },
    tasks: { owners: ["documents", "company"], write: true },
    memory: { owners: ["documents"], write: true },
    finance_raw: { owners: [], write: false },
    email: { owners: [], write: false },
    calendar: { owners: ["company"], write: false },
    meetings: { owners: [], write: false },
    finance_summary: { owners: [], write: false },
  },
  company: {
    email: { owners: ["company"], write: true, sendExternal: "approval" },
    calendar: { owners: ["company"], write: true },
    contacts: { owners: ["company"], write: true },
    documents: { owners: ["company"], write: true },
    tasks: { owners: ["company"], write: true },
    meetings: { owners: ["company"], write: true },
    memory: { owners: ["company"], write: true },
    finance_summary: { owners: ["company"], write: true },
    finance_raw: { owners: [], write: false },
  },
  system: {
    email: { owners: ["*"], write: true, sendExternal: "approval" },
    calendar: { owners: ["*"], write: true },
    contacts: { owners: ["*"], write: true },
    documents: { owners: ["*"], write: true },
    tasks: { owners: ["*"], write: true },
    meetings: { owners: ["*"], write: true },
    memory: { owners: ["*"], write: true },
    finance_summary: { owners: ["*"], write: true },
    finance_raw: { owners: ["finance"], write: false },
  },
};

const CLASSIFICATION_RANK: Record<DataClassification, number> = {
  [DataClassification.Public]: 0,
  [DataClassification.Internal]: 1,
  [DataClassification.Confidential]: 2,
  [DataClassification.Restricted]: 3,
};

export class PolicyEngine {
  check(req: PermissionRequest): PermissionDecision {
    // Confidential / restricted never leave private plane
    if (
      req.targetPlane === "connected" &&
      req.classification &&
      CLASSIFICATION_RANK[req.classification] >=
        CLASSIFICATION_RANK[DataClassification.Confidential]
    ) {
      return {
        decision: "denied",
        reason: `Classification ${req.classification} cannot enter Connected Plane`,
      };
    }

    const matrix = ACCESS[req.agentId];
    const rule = matrix?.[req.resource];
    if (!rule) {
      return {
        decision: "denied",
        reason: `Agent ${req.agentId} has no access to ${req.resource}`,
      };
    }

    const owner = req.resourceOwner ?? "company";
    const ownerOk =
      rule.owners.includes("*") ||
      rule.owners.includes(owner) ||
      (rule.owners.length === 0 ? false : false);

    if (!ownerOk && rule.owners.length > 0) {
      return {
        decision: "denied",
        reason: `Agent ${req.agentId} cannot access ${req.resource} owned by ${owner}`,
      };
    }
    if (rule.owners.length === 0) {
      return {
        decision: "denied",
        reason: `Agent ${req.agentId} is blocked from ${req.resource}`,
      };
    }

    if ((req.action === "write" || req.action === "execute") && !rule.write) {
      return {
        decision: "denied",
        reason: `Agent ${req.agentId} cannot write ${req.resource}`,
      };
    }

    if (req.action === "send_external") {
      const send = rule.sendExternal ?? "never";
      if (send === "never") {
        return {
          decision: "denied",
          reason: `Agent ${req.agentId} cannot send external ${req.resource}`,
        };
      }
      if (send === "approval") {
        return {
          decision: "approval_required",
          reason: "External send requires human approval (Level 1)",
        };
      }
    }

    return { decision: "allowed" };
  }

  /** Sanitize payload for Connected Plane — strip confidential fields. */
  sanitizeForConnected(
    payload: Record<string, unknown>,
    classification: DataClassification
  ): { ok: true; payload: Record<string, unknown> } | { ok: false; reason: string } {
    if (
      CLASSIFICATION_RANK[classification] >=
      CLASSIFICATION_RANK[DataClassification.Confidential]
    ) {
      const allowedKeys = [
        "event_type",
        "agent",
        "priority",
        "suggested_action",
        "report_id",
        "status",
        "review_required",
        "title",
        "meeting_id",
        "task_id",
      ];
      const clean: Record<string, unknown> = {};
      for (const key of allowedKeys) {
        if (key in payload) clean[key] = payload[key];
      }
      // Reject if any raw financial/PII-looking keys remain attempted
      const forbidden = [
        "revenue",
        "payroll",
        "bank",
        "ssn",
        "password",
        "raw",
        "amount",
        "salary",
      ];
      for (const key of Object.keys(payload)) {
        if (forbidden.some((f) => key.toLowerCase().includes(f))) {
          return {
            ok: false,
            reason: `Forbidden confidential key attempted for Connected Plane: ${key}`,
          };
        }
      }
      return { ok: true, payload: clean };
    }
    return { ok: true, payload };
  }
}

export const defaultPolicy = new PolicyEngine();
