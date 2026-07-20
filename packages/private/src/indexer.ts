import { DataClassification, newId, type DocumentRecord } from "@agent-test/contracts";

export interface IndexedChunk {
  id: string;
  documentId: string;
  text: string;
  tokens: string[];
}

export interface SearchHit {
  documentId: string;
  score: number;
  snippet: string;
}

/** Lightweight local keyword index — Private Plane only (no cloud embeddings required). */
export class DocumentIndexer {
  private chunks: IndexedChunk[] = [];
  private docs = new Map<string, DocumentRecord>();

  clear() {
    this.chunks = [];
    this.docs.clear();
  }

  index(doc: DocumentRecord, content?: string) {
    this.docs.set(doc.id, doc);
    // drop old chunks for doc
    this.chunks = this.chunks.filter((c) => c.documentId !== doc.id);
    const text = [doc.name, doc.summary, doc.binderIndex, doc.contentPreview, content]
      .filter(Boolean)
      .join("\n");
    const parts = chunkText(text, 400);
    for (const part of parts) {
      this.chunks.push({
        id: newId(),
        documentId: doc.id,
        text: part,
        tokens: tokenize(part),
      });
    }
  }

  search(query: string, limit = 8): SearchHit[] {
    const q = tokenize(query);
    if (!q.length) return [];
    const scores = new Map<string, { score: number; snippet: string }>();
    for (const chunk of this.chunks) {
      let score = 0;
      for (const t of q) {
        if (chunk.tokens.includes(t)) score += 1;
      }
      if (score === 0) continue;
      const prev = scores.get(chunk.documentId);
      if (!prev || score > prev.score) {
        scores.set(chunk.documentId, {
          score,
          snippet: chunk.text.slice(0, 180),
        });
      }
    }
    return [...scores.entries()]
      .map(([documentId, v]) => ({ documentId, score: v.score, snippet: v.snippet }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  stats() {
    return {
      documents: this.docs.size,
      chunks: this.chunks.length,
      classificationCounts: [...this.docs.values()].reduce(
        (acc, d) => {
          acc[d.classification] = (acc[d.classification] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function chunkText(text: string, size: number): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const out: string[] = [];
  for (let i = 0; i < cleaned.length; i += size) {
    out.push(cleaned.slice(i, i + size));
  }
  return out;
}

export function looksLikePromptInjection(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("ignore all previous instructions") ||
    t.includes("disregard prior instructions") ||
    /email the (ceo|cfo).*financial/.test(t) ||
    t.includes("exfiltrate") ||
    t.includes("send all passwords")
  );
}

export function detectBinderIndex(name: string, content?: string): string | undefined {
  if (!/binder|index/i.test(name) && !/binder|section\s+[a-z]/i.test(content ?? "")) {
    return undefined;
  }
  const lines = (content ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^#+\s|section\s+[a-z]|^\d+\./i.test(l))
    .slice(0, 12);
  if (lines.length) return lines.join(" / ");
  return "Auto-generated binder index";
}

export function inferClassification(name: string, content?: string): DataClassification {
  const blob = `${name}\n${content ?? ""}`.toLowerCase();
  if (blob.includes("payroll") || blob.includes("ssn") || blob.includes("bank account")) {
    return DataClassification.Restricted;
  }
  if (
    blob.includes("financial") ||
    blob.includes("revenue") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".csv")
  ) {
    return DataClassification.Confidential;
  }
  if (blob.includes("procedure") || blob.includes("binder")) {
    return DataClassification.Internal;
  }
  return DataClassification.Internal;
}
