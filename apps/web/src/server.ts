/**
 * Railway Connected Plane stub — lightweight Agent Gateway.
 * Does not run LLMs. Accepts sanitized Action Bus messages and
 * exposes permission-checked tool endpoints for later real adapters.
 */
import http from "node:http";
import { randomUUID } from "node:crypto";
import { DataClassification } from "@agent-test/contracts";
import { defaultPolicy } from "@agent-test/permissions";

const PORT = Number(process.env.PORT ?? 8080);

interface ActionRequest {
  agent: string;
  action: string;
  payload?: Record<string, unknown>;
  classification?: DataClassification;
}

const actionLog: Array<Record<string, unknown>> = [];

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
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/actions") {
    json(res, 200, { actions: actionLog });
    return;
  }

  if (req.method === "POST" && url.pathname === "/agent/action") {
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

    // Map high-level actions to resource checks
    const resource =
      body.action.includes("email")
        ? "email"
        : body.action.includes("meeting") || body.action.includes("calendar")
          ? "calendar"
          : body.action.includes("task")
            ? "tasks"
            : "meetings";

    const decision = defaultPolicy.check({
      agentId: (body.agent as "melanie" | "admin" | "finance" | "documents" | "company" | "system") || "admin",
      action: body.action.includes("send") ? "send_external" : "execute",
      resource: resource as "email" | "calendar" | "tasks" | "meetings",
      resourceOwner: body.agent === "melanie" ? "melanie" : "company",
      classification,
      targetPlane: "connected",
    });

    if (decision.decision === "denied") {
      json(res, 403, { error: "denied", reason: decision.reason });
      return;
    }

    const entry = {
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
      agent: body.agent,
      action: body.action,
      decision: decision.decision,
      payload: sanitized.payload,
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

  json(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`agent-test control plane on :${PORT}`);
});
