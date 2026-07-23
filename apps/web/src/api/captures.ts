export interface Capture {
  id: string;
  raw_text: string;
  created_at: string;
}

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export async function createCapture(rawText: string): Promise<Capture> {
  const response = await fetch(`${apiBaseUrl}/captures`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw_text: rawText }),
  });

  if (!response.ok) {
    throw new Error(`Capture request failed with status ${response.status}`);
  }

  return (await response.json()) as Capture;
}
