export interface Capture {
  id: string;
  raw_text: string;
  created_at: string;
}

export const MAX_CAPTURE_CHARACTERS = 50_000;
const CAPTURE_REQUEST_TIMEOUT_MS = 15_000;

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

function isCapture(value: unknown): value is Capture {
  if (typeof value !== "object" || value === null) return false;

  const capture = value as Record<string, unknown>;
  return (
    typeof capture.id === "string" &&
    typeof capture.raw_text === "string" &&
    typeof capture.created_at === "string"
  );
}

export async function createCapture(rawText: string): Promise<Capture> {
  const response = await fetch(`${apiBaseUrl}/captures`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw_text: rawText }),
    signal: AbortSignal.timeout(CAPTURE_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Capture request failed with status ${response.status}`);
  }

  const responseBody: unknown = await response.json();
  if (!isCapture(responseBody)) {
    throw new Error("Capture response did not match the expected shape");
  }

  return responseBody;
}
