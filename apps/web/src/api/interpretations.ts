import type { Capture } from "./captures";

export interface ActionProposal {
  id: string;
  description: string;
  duration?: {
    minimum_minutes: number;
    maximum_minutes: number;
  } | null;
}

export interface TaskProposal {
  id: string;
  title: string;
  actions: ActionProposal[];
  deadline?: {
    date: string;
  } | null;
}

export interface Interpretation {
  id: string;
  capture_id: string;
  version: number;
  status: "proposed" | "confirmed";
  proposal: {
    tasks: TaskProposal[];
  };
}

export interface ReviewedTask {
  id: string;
  title: string;
  action_id: string;
  action_description: string;
}

const INTERPRETATION_REQUEST_TIMEOUT_MS = 15_000;
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

function isActionProposal(value: unknown): value is ActionProposal {
  if (typeof value !== "object" || value === null) return false;
  const action = value as Record<string, unknown>;
  if (typeof action.id !== "string" || typeof action.description !== "string") {
    return false;
  }
  if (action.duration === undefined || action.duration === null) return true;
  if (typeof action.duration !== "object") return false;

  const duration = action.duration as Record<string, unknown>;
  return (
    typeof duration.minimum_minutes === "number" &&
    typeof duration.maximum_minutes === "number"
  );
}

function isTaskProposal(value: unknown): value is TaskProposal {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  if (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    Array.isArray(task.actions) &&
    task.actions.length > 0 &&
    task.actions.every(isActionProposal)
  ) {
    if (task.deadline === undefined || task.deadline === null) return true;
    if (typeof task.deadline !== "object") return false;
    return typeof (task.deadline as Record<string, unknown>).date === "string";
  }
  return false;
}

function isInterpretation(value: unknown): value is Interpretation {
  if (typeof value !== "object" || value === null) return false;
  const interpretation = value as Record<string, unknown>;
  if (
    typeof interpretation.id !== "string" ||
    typeof interpretation.capture_id !== "string" ||
    typeof interpretation.version !== "number" ||
    (interpretation.status !== "proposed" && interpretation.status !== "confirmed") ||
    typeof interpretation.proposal !== "object" ||
    interpretation.proposal === null
  ) {
    return false;
  }

  const proposal = interpretation.proposal as Record<string, unknown>;
  return Array.isArray(proposal.tasks) && proposal.tasks.every(isTaskProposal);
}

function localReferenceTime(now = new Date()): string {
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absoluteOffset / 60)).padStart(2, "0");
  const minutes = String(absoluteOffset % 60).padStart(2, "0");
  const localClock = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, -1);
  return `${localClock}${sign}${hours}:${minutes}`;
}

async function interpretationResponse(response: Response): Promise<Interpretation> {
  if (!response.ok) {
    throw new Error(`Interpretation request failed with status ${response.status}`);
  }

  const responseBody: unknown = await response.json();
  if (!isInterpretation(responseBody)) {
    throw new Error("Interpretation response did not match the expected shape");
  }
  return responseBody;
}

export async function createInterpretation(capture: Capture): Promise<Interpretation> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const response = await fetch(`${apiBaseUrl}/captures/${capture.id}/interpretations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reference_time: localReferenceTime(),
      time_zone: timeZone,
    }),
    signal: AbortSignal.timeout(INTERPRETATION_REQUEST_TIMEOUT_MS),
  });
  return interpretationResponse(response);
}

export async function confirmInterpretation(
  interpretation: Interpretation,
  tasks: ReviewedTask[],
): Promise<Interpretation> {
  const response = await fetch(
    `${apiBaseUrl}/captures/${interpretation.capture_id}/interpretations/${interpretation.id}/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tasks }),
      signal: AbortSignal.timeout(INTERPRETATION_REQUEST_TIMEOUT_MS),
    },
  );
  return interpretationResponse(response);
}
