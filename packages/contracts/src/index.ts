/** Data sensitivity — enforced by PolicyEngine before any model/tool call. */
export enum DataClassification {
  Public = "public",
  Internal = "internal",
  Confidential = "confidential",
  Restricted = "restricted",
}

export type AgentId =
  | "melanie"
  | "admin"
  | "finance"
  | "documents"
  | "company"
  | "system";

export type ExecutionMode = "simulation" | "shadow" | "live";

export type Plane = "private" | "connected";

export type ApprovalLevel = 1 | 2 | 3;

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  organizationId: string;
  notes?: string;
}

export interface Organization {
  id: string;
  name: string;
  location?: string;
  notes?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string;
  calendarId: string;
  participantIds: string[];
  meetingUrl?: string;
  description?: string;
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  receivedAt: string;
  folder: "inbox" | "sent" | "drafts";
  attachmentIds?: string[];
  processed?: boolean;
}

export interface Task {
  id: string;
  title: string;
  owner: AgentId | string;
  dueDate?: string;
  source?: string;
  status: "open" | "waiting_approval" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high";
  relatedContactId?: string;
  relatedOrganizationId?: string;
  relatedDocumentId?: string;
  nextAction?: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  classification: DataClassification;
  summary?: string;
  binderIndex?: string;
  tags: string[];
  uploadedAt: string;
  contentPreview?: string;
}

export interface Interaction {
  id: string;
  contactId: string;
  date: string;
  type: "email" | "meeting" | "call" | "note";
  summary: string;
}

export interface FinancialFinding {
  id: string;
  reportId: string;
  summary: string;
  severity: "info" | "warning" | "critical";
  service?: string;
  metric?: string;
  changePct?: number;
  reviewRequired: boolean;
  /** Never leave private plane as raw numbers in connected payloads. */
  detailsPrivate: boolean;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  agentId: AgentId;
  input?: string;
  intent?: string;
  tool?: string;
  arguments?: Record<string, unknown>;
  permissionDecision: "allowed" | "denied" | "approval_required";
  result?: string;
  plane: Plane;
  classification?: DataClassification;
}

export type ActionBusEventType =
  | "ScheduleMeeting"
  | "SendApprovedEmail"
  | "RequestDocumentAnalysis"
  | "FinancialReviewRequired"
  | "CreateTask"
  | "AddAgendaItem"
  | "DisambiguationRequired"
  | "ApprovalRequired";

export interface ActionBusMessage {
  id: string;
  type: ActionBusEventType;
  fromAgent: AgentId;
  toPlane: Plane;
  payload: Record<string, unknown>;
  classification: DataClassification;
  timestamp: string;
  status: "queued" | "approved" | "executed" | "rejected" | "blocked";
}

export interface ProposedAction {
  id: string;
  agentId: AgentId;
  title: string;
  description: string;
  workflowSteps: WorkflowStep[];
  status: "pending" | "approved" | "rejected" | "executed";
  relatedEmailId?: string;
  createdAt: string;
}

export interface WorkflowStep {
  id: string;
  label: string;
  status: "pending" | "done" | "skipped" | "blocked";
  tool?: string;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface AgentCapability {
  agentId: AgentId;
  label: string;
  plane: Plane;
  model: string;
  canAccess: string[];
  cannotAccess: string[];
  canExecute: string[];
  requiresApproval: string[];
  online: boolean;
}

export interface AgentTraceStep {
  step: number;
  kind: "intent" | "tool_request" | "tool_result" | "permission" | "response" | "action";
  message: string;
  data?: Record<string, unknown>;
}

export interface AgentRunResult {
  agentId: AgentId;
  input: string;
  intent?: string;
  trace: AgentTraceStep[];
  proposedAction?: ProposedAction;
  needsDisambiguation?: { options: Contact[]; question: string };
  denied?: string;
  messages?: string[];
}

export interface LLMProvider {
  complete(request: {
    agentId: AgentId;
    system: string;
    input: string;
    context?: Record<string, unknown>;
  }): Promise<{
    intent: string;
    toolCalls: Array<{ tool: string; arguments: Record<string, unknown> }>;
    message?: string;
  }>;
}

export interface CalendarTool {
  getAvailability(
    calendarId: string,
    windowStart: string,
    windowEnd: string,
    durationMinutes: number
  ): Promise<AvailabilitySlot[]>;
  createEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent>;
  updateEvent(id: string, patch: Partial<CalendarEvent>): Promise<CalendarEvent>;
  listEvents(calendarId: string): Promise<CalendarEvent[]>;
}

export interface EmailTool {
  listInbox(accountId: string): Promise<EmailMessage[]>;
  search(accountId: string, query: string): Promise<EmailMessage[]>;
  draftReply(messageId: string, body: string): Promise<EmailMessage>;
  send(message: Omit<EmailMessage, "id" | "receivedAt" | "folder">): Promise<EmailMessage>;
}

export interface ContactsTool {
  findContact(query: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: Omit<Contact, "id">): Promise<Contact>;
  updateContact(id: string, patch: Partial<Contact>): Promise<Contact>;
  listOrganizations(): Promise<Organization[]>;
}

export interface MeetingTool {
  createZoom(title: string, start: string): Promise<{ url: string; meetingId: string }>;
  createGoogleMeet(title: string, start: string): Promise<{ url: string; meetingId: string }>;
}

export interface TaskTool {
  createTask(task: Omit<Task, "id">): Promise<Task>;
  completeTask(id: string): Promise<Task>;
  getOverdueTasks(): Promise<Task[]>;
  listTasks(): Promise<Task[]>;
}

export interface DocumentTool {
  ingest(file: {
    name: string;
    path: string;
    mimeType: string;
    content?: string;
  }): Promise<DocumentRecord>;
  search(query: string): Promise<DocumentRecord[]>;
  get(id: string): Promise<DocumentRecord | undefined>;
  list(): Promise<DocumentRecord[]>;
}

export interface FinanceTool {
  analyzeSpreadsheet(documentId: string): Promise<FinancialFinding[]>;
  listFindings(): Promise<FinancialFinding[]>;
}

export { newId } from "./id";
