import { DataClassification, newId, type FinancialFinding } from "@agent-test/contracts";

export interface ServiceRow {
  service: string;
  revenue: number;
  cost: number;
  margin: number;
  /** Prior period margin if present */
  priorMargin?: number;
  client?: string;
  hours?: number;
}

export interface FinanceWorkbook {
  rows: ServiceRow[];
  period?: string;
  source: string;
}

/** Parse CSV text with headers like Service,Revenue,Cost,Margin[,PriorMargin][,Client][,Hours] */
export function parseFinanceCsv(text: string, source = "upload.csv"): FinanceWorkbook {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return { rows: [], source };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const idx = (name: string) => headers.findIndex((h) => h === name || h.includes(name));

  const iService = Math.max(0, idx("service"));
  const iRevenue = idx("revenue");
  const iCost = idx("cost");
  const iMargin = idx("margin");
  const iPrior = idx("prior");
  const iClient = idx("client");
  const iHours = idx("hours");

  const rows: ServiceRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const service = cols[iService]?.trim() || "Unknown";
    const revenue = num(cols[iRevenue]);
    const cost = num(cols[iCost]);
    let margin = num(cols[iMargin]);
    if (!Number.isFinite(margin) && Number.isFinite(revenue) && revenue !== 0) {
      margin = (revenue - cost) / revenue;
    }
    const priorMargin = iPrior >= 0 ? num(cols[iPrior]) : undefined;
    rows.push({
      service,
      revenue: Number.isFinite(revenue) ? revenue : 0,
      cost: Number.isFinite(cost) ? cost : 0,
      margin: Number.isFinite(margin) ? margin : 0,
      priorMargin: Number.isFinite(priorMargin!) ? priorMargin : undefined,
      client: iClient >= 0 ? cols[iClient]?.trim() : undefined,
      hours: iHours >= 0 ? num(cols[iHours]) : undefined,
    });
  }

  const periodMatch = text.match(/Q[1-4]\s*20\d{2}|20\d{2}-Q[1-4]|FY\s*20\d{2}/i);
  return {
    rows,
    period: periodMatch?.[0],
    source,
  };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function num(v: string | undefined): number {
  if (v == null || v === "") return NaN;
  const cleaned = v.replace(/[$,%\s]/g, "");
  const n = Number(cleaned);
  // margins given as 19 or 0.19
  if (/margin/i.test(v) === false && cleaned.includes(".") === false && n > 1 && n <= 100) {
    // leave as-is for revenue/cost
  }
  return n;
}

/**
 * Analyze workbook into findings. All detailed numbers stay Private Plane;
 * only summaries are intended for UI / sanitized Action Bus.
 */
export function analyzeFinanceWorkbook(
  workbook: FinanceWorkbook,
  reportId = `report-${newId().slice(0, 8)}`
): FinancialFinding[] {
  const findings: FinancialFinding[] = [];

  for (const row of workbook.rows) {
    const marginPct = row.margin <= 1 ? row.margin * 100 : row.margin;
    const prior =
      row.priorMargin == null
        ? undefined
        : row.priorMargin <= 1
          ? row.priorMargin * 100
          : row.priorMargin;

    if (prior != null) {
      const change = marginPct - prior;
      if (Math.abs(change) >= 5) {
        findings.push({
          id: newId(),
          reportId,
          summary: `${row.service} margin ${change < 0 ? "fell" : "rose"} from ${prior.toFixed(0)}% to ${marginPct.toFixed(0)}%`,
          severity: change <= -8 ? "critical" : change < 0 ? "warning" : "info",
          service: row.service,
          metric: "margin",
          changePct: Math.round(change * 10) / 10,
          reviewRequired: change <= -5,
          detailsPrivate: true,
        });
      } else {
        findings.push({
          id: newId(),
          reportId,
          summary: `${row.service} margin stable at ${marginPct.toFixed(0)}%`,
          severity: "info",
          service: row.service,
          metric: "margin",
          changePct: Math.round(change * 10) / 10,
          reviewRequired: false,
          detailsPrivate: true,
        });
      }
    } else {
      findings.push({
        id: newId(),
        reportId,
        summary: `${row.service}: margin ${marginPct.toFixed(0)}% on revenue basis`,
        severity: marginPct < 20 ? "warning" : "info",
        service: row.service,
        metric: "margin",
        changePct: 0,
        reviewRequired: marginPct < 15,
        detailsPrivate: true,
      });
    }
  }

  // Client concentration / hours disproportion (aggregate by client when present)
  const byClient = new Map<string, { hours: number; revenue: number }>();
  for (const row of workbook.rows) {
    const key = row.client ?? row.service;
    const cur = byClient.get(key) ?? { hours: 0, revenue: 0 };
    cur.hours += row.hours ?? 0;
    cur.revenue += row.revenue;
    byClient.set(key, cur);
  }
  const clients = [...byClient.entries()].filter(([, v]) => v.hours > 0);
  if (clients.length >= 2) {
    const totalHours = clients.reduce((s, [, v]) => s + v.hours, 0) || 1;
    const totalRev = clients.reduce((s, [, v]) => s + v.revenue, 0) || 1;
    for (const [client, v] of clients) {
      const hourShare = v.hours / totalHours;
      const revShare = v.revenue / totalRev;
      if (hourShare > revShare + 0.12) {
        findings.push({
          id: newId(),
          reportId,
          summary: `${client} consumes disproportionate delivery hours vs revenue`,
          severity: "warning",
          service: client,
          reviewRequired: true,
          detailsPrivate: true,
        });
      }
    }
  }

  if (findings.length === 0) {
    findings.push({
      id: newId(),
      reportId,
      summary: `No material variance detected in ${workbook.source}`,
      severity: "info",
      reviewRequired: false,
      detailsPrivate: true,
    });
  }

  return findings;
}

export function classifyFinanceDocument(name: string, content?: string): DataClassification {
  const blob = `${name}\n${content ?? ""}`.toLowerCase();
  if (blob.includes("payroll") || blob.includes("bank") || blob.includes("ssn")) {
    return DataClassification.Restricted;
  }
  if (
    blob.includes("financial") ||
    blob.includes("revenue") ||
    blob.includes("margin") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".csv")
  ) {
    return DataClassification.Confidential;
  }
  return DataClassification.Internal;
}
