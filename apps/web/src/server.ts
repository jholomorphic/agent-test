/**
 * Railway Connected Plane — lightweight Agent Gateway.
 * Coordinates email/calendar/meeting/task tools. Does NOT run LLMs
 * or hold confidential financial/document payloads.
 */
import http from "node:http";
import { randomUUID } from "node:crypto";
import { DataClassification } from "@agent-test/contracts";
import { defaultPolicy } from "@agent-test/permissions";

const PORT = Number(process.env.PORT ?? 8080);
const USAGE_LIMIT_USD = Number(process.env.RAILWAY_USAGE_LIMIT_USD ?? 15);

interface ActionRequest {
  agent: string;
  action: string;
  payload?: Record<string, unknown>;
  classification?: DataClassification;
}

const actionLog: Array<Record<string, unknown>> = [];
const cronJobs: Array<{ id: string; name: string; everyMinutes: number; lastRun?: string }> = [
  { id: "cron-reminders", name: "Send due reminders", everyMinutes: 15 },
  { id: "cron-overdue", name: "Flag overdue tasks", everyMinutes: 60 },
  { id: "cron-health", name: "Gateway health pulse", everyMinutes: 5 },
];

let estimatedUsageUsd = 0.02;

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body, null, 2));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function toolCatalog() {
  return {
    EMAIL: ["read_email", "search_email", "draft_reply", "send_email", "forward_email"],
    CALENDAR: [
      "get_availability",
      "create_event",
      "modify_event",
      "cancel_event",
      "send_invitation",
    ],
    MEETINGS: ["create_zoom", "create_google_meet", "send_meeting_details"],
    CONTACTS: ["find_contact", "update_contact", "create_contact", "find_organization"],
    TASKS: ["create_task", "complete_task", "get_overdue_tasks", "schedule_reminder"],
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, {
      ok: true,
      service: "agent-test-control-plane",
      plane: "connected",
      llm: false,
      usage: { estimatedUsd: estimatedUsageUsd, hardLimitUsd: USAGE_LIMIT_USD },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/tools") {
    json(res, 200, { tools: toolCatalog(), note: "Executed only after permission checks" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/cron") {
    json(res, 200, { jobs: cronJobs });
    return;
  }

  if (req.method === "POST" && url.pathname === "/cron/tick") {
    if (estimatedUsageUsd >= USAGE_LIMIT_USD) {
      json(res, 429, { error: "usage_limit", limitUsd: USAGE_LIMIT_USD });
      return;
    }
    const now = new Date().toISOString();
    for (const job of cronJobs) job.lastRun = now;
    estimatedUsageUsd = Math.round((estimatedUsageUsd + 0.001) * 1000) / 1000;
    actionLog.push({
      id: randomUUID(),
      type: "cron_tick",
      at: now,
      jobs: cronJobs.map((j) => j.id),
    });
    json(res, 200, { ok: true, ran: cronJobs.length, usageUsd: estimatedUsageUsd });
    return;
  }

  if (req.method === "GET" && url.pathname === "/actions") {
    json(res, 200, { actions: actionLog });
    return;
  }

  if (req.method === "POST" && url.pathname === "/agent/action") {
    if (estimatedUsageUsd >= USAGE_LIMIT_USD) {
      json(res, 429, { error: "usage_limit", limitUsd: USAGE_LIMIT_USD });
      return;
    }

    const raw = await readBody(req);
    let body: ActionRequest;
    try {
      body = JSON.parse(raw) as ActionRequest;
    } catch {
      json(res, 400, { error: "invalid_json" });
      return;
    }

    const classification =
      body.classification ?? DataClassification.Internal;

    const sanitized = defaultPolicy.sanitizeForConnected(
      body.payload ?? {},
      classification
    );
    if (!sanitized.ok) {
      json(res, 403, { error: "blocked", reason: sanitized.reason });
      return;
    }

    const resource =
      body.action.includes("email")
        ? "email"
        : body.action.includes("meeting") || body.action.includes("calendar")
          ? "calendar"
          : body.action.includes("task")
            ? "tasks"
            : body.action.includes("contact")
              ? "contacts"
              : "meetings";

    const agentId = (body.agent || "admin") as
      | "melanie"
      | "admin"
      | "finance"
      | "documents"
      | "company"
      | "system";

    const decision = defaultPolicy.check({
      agentId,
      action: body.action.includes("send") ? "send_external" : "execute",
      resource: resource as "email" | "calendar" | "tasks" | "meetings" | "contacts",
      resourceOwner: body.agent === "melanie" ? "melanie" : "company",
      classification,
      targetPlane: "connected",
    });

    if (decision.decision === "denied") {
      json(res, 403, { error: "denied", reason: decision.reason });
      return;
    }

    estimatedUsageUsd = Math.round((estimatedUsageUsd + 0.002) * 1000) / 1000;
    const entry = {
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
      agent: body.agent,
      action: body.action,
      decision: decision.decision,
      payload: sanitized.payload,
      usageUsd: estimatedUsageUsd,
    };
    actionLog.push(entry);

    json(res, decision.decision === "approval_required" ? 202 : 200, {
      ok: true,
      ...entry,
      message:
        decision.decision === "approval_required"
          ? "Queued for human approval"
          : "Accepted by Connected Plane gateway",
    });
    return;
  }

  json(res, 404, {
    error: "not_found",
    routes: [
      "GET /health",
      "GET /tools",
      "GET /cron",
      "POST /cron/tick",
      "GET /actions",
      "POST /agent/action",
    ],
  });
});

server.listen(PORT, () => {
  console.log(`agent-test control plane on :${PORT} (usage cap $${USAGE_LIMIT_USD})`);
});
