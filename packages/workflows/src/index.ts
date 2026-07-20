import type { WorkflowStep } from "@agent-test/contracts";

/** Declarative meeting automation shown in Automation Studio. */
export const meetingAutomation = {
  id: "meeting-from-email",
  when: "new_email_received",
  if: "message_requests_meeting",
  steps: [
    "Ask Scheduling Agent",
    "Check calendar",
    "Propose available times",
    "Human approval",
    "Create event",
    "Generate meeting link",
    "Draft confirmation",
  ] as const,
};

export function meetingWorkflowSteps(): WorkflowStep[] {
  return meetingAutomation.steps.map((label, i) => ({
    id: String(i + 1),
    label,
    status: i < 3 ? "done" : "pending",
  }));
}
