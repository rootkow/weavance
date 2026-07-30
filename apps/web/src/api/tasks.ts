export type TaskStatus = "active" | "completed" | "archived";
export type ActionStatus = "active" | "completed" | "archived";

export interface Action {
  id: string;
  task_id: string;
  source_interpretation_id: string;
  description: string;
  status: ActionStatus;
  position: number;
  duration?: {
    minimum_minutes: number;
    maximum_minutes: number;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  source_capture_id: string;
  source_interpretation_id: string;
  title: string;
  status: TaskStatus;
  deadline?: {
    date: string;
  } | null;
  actions: Action[];
  created_at: string;
  updated_at: string;
}

const TASK_REQUEST_TIMEOUT_MS = 15_000;
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

function isAction(value: unknown): value is Action {
  if (typeof value !== "object" || value === null) return false;
  const action = value as Record<string, unknown>;
  return (
    typeof action.id === "string" &&
    typeof action.task_id === "string" &&
    typeof action.source_interpretation_id === "string" &&
    typeof action.description === "string" &&
    (action.status === "active" ||
      action.status === "completed" ||
      action.status === "archived") &&
    typeof action.position === "number" &&
    typeof action.created_at === "string" &&
    typeof action.updated_at === "string"
  );
}

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  if (
    typeof task.id !== "string" ||
    typeof task.source_capture_id !== "string" ||
    typeof task.source_interpretation_id !== "string" ||
    typeof task.title !== "string" ||
    (task.status !== "active" &&
      task.status !== "completed" &&
      task.status !== "archived") ||
    typeof task.created_at !== "string" ||
    typeof task.updated_at !== "string" ||
    !Array.isArray(task.actions) ||
    task.actions.length === 0 ||
    !task.actions.every(isAction)
  ) {
    return false;
  }
  if (task.deadline === undefined || task.deadline === null) return true;
  return (
    typeof task.deadline === "object" &&
    typeof (task.deadline as Record<string, unknown>).date === "string"
  );
}

async function taskResponse(response: Response): Promise<Task> {
  if (!response.ok) {
    throw new Error(`Task request failed with status ${response.status}`);
  }
  const responseBody: unknown = await response.json();
  if (!isTask(responseBody)) {
    throw new Error("Task response did not match the expected shape");
  }
  return responseBody;
}

export async function listTasks(signal?: AbortSignal): Promise<Task[]> {
  const response = await fetch(`${apiBaseUrl}/tasks`, {
    method: "GET",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Task request failed with status ${response.status}`);
  }
  const responseBody: unknown = await response.json();
  if (!Array.isArray(responseBody) || !responseBody.every(isTask)) {
    throw new Error("Task list did not match the expected shape");
  }
  return responseBody;
}

export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
  signal: AbortSignal = AbortSignal.timeout(TASK_REQUEST_TIMEOUT_MS),
): Promise<Task> {
  const response = await fetch(`${apiBaseUrl}/tasks/${taskId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
    signal,
  });
  return taskResponse(response);
}

export async function updateTaskContent(
  taskId: string,
  actionId: string,
  title: string,
  actionDescription: string,
  signal: AbortSignal = AbortSignal.timeout(TASK_REQUEST_TIMEOUT_MS),
): Promise<Task> {
  const response = await fetch(`${apiBaseUrl}/tasks/${taskId}/content`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      action_id: actionId,
      action_description: actionDescription,
    }),
    signal,
  });
  return taskResponse(response);
}
