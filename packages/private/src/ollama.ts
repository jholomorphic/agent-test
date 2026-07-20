import type { AgentId, LLMProvider } from "@agent-test/contracts";

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

/**
 * OpenAI-compatible Ollama chat completions adapter.
 * Falls through to a provided fallback (usually MockLLM) when offline.
 */
export class OllamaLLMProvider implements LLMProvider {
  constructor(
    private config: OllamaConfig,
    private fallback?: LLMProvider
  ) {}

  async complete(request: {
    agentId: AgentId;
    system: string;
    input: string;
    context?: Record<string, unknown>;
  }) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs ?? 12_000
      );
      const res = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.model,
          stream: false,
          format: "json",
          messages: [
            {
              role: "system",
              content: `${request.system}

Respond ONLY with JSON:
{"intent":"schedule_meeting|analyze_financials|ingest_document|general|reject_untrusted_content","toolCalls":[{"tool":"string","arguments":{}}],"message":"string"}`,
            },
            { role: "user", content: request.input },
          ],
        }),
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`ollama_http_${res.status}`);
      const data = (await res.json()) as {
        message?: { content?: string };
      };
      const content = data.message?.content ?? "{}";
      const parsed = JSON.parse(content) as {
        intent?: string;
        toolCalls?: Array<{ tool: string; arguments: Record<string, unknown> }>;
        message?: string;
      };
      return {
        intent: parsed.intent ?? "general",
        toolCalls: parsed.toolCalls ?? [],
        message: parsed.message,
      };
    } catch (err) {
      if (this.fallback) {
        return this.fallback.complete(request);
      }
      throw err;
    }
  }
}

/** Probe whether Ollama is reachable. */
export async function probeOllama(
  baseUrl: string,
  timeoutMs = 2500
): Promise<{ online: boolean; models: string[]; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { online: false, models: [], error: `http_${res.status}` };
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return {
      online: true,
      models: (data.models ?? []).map((m) => m.name),
    };
  } catch (e) {
    return {
      online: false,
      models: [],
      error: e instanceof Error ? e.message : "unreachable",
    };
  }
}
