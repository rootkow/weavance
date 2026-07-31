export type RecommendationState = "proposed" | "accepted" | "closed";
export type EpisodeEventType =
  | "accepted"
  | "resized"
  | "deferred"
  | "swapped"
  | "overwhelmed"
  | "done_for_now"
  | "progress_made"
  | "did_not_start"
  | "keep_going";

export interface Recommendation {
  id: string;
  task_id: string;
  action_id: string;
  parent_episode_id: string | null;
  task_title: string;
  action_description: string;
  entry_point: string;
  stopping_condition: string;
  context_snapshot: {
    available_minutes?: number | null;
    easier_requested?: boolean;
    constraints?: string[];
  };
  explanation_factors: Array<Record<string, unknown>>;
  reason: string;
  strategy_name: string;
  strategy_version: string;
  state: RecommendationState;
  created_at: string;
}

export interface RecommendationTransition {
  event: {
    id: string;
    episode_id: string;
    event_type: EpisodeEventType;
    payload: Record<string, unknown>;
    created_at: string;
  };
  episode: Recommendation;
  replacement: Recommendation | null;
}

const RECOMMENDATION_REQUEST_TIMEOUT_MS = 15_000;
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

function isRecommendation(value: unknown): value is Recommendation {
  if (typeof value !== "object" || value === null) return false;
  const recommendation = value as Record<string, unknown>;
  return (
    typeof recommendation.id === "string" &&
    typeof recommendation.task_id === "string" &&
    typeof recommendation.action_id === "string" &&
    (recommendation.parent_episode_id === null ||
      typeof recommendation.parent_episode_id === "string") &&
    typeof recommendation.task_title === "string" &&
    typeof recommendation.action_description === "string" &&
    typeof recommendation.entry_point === "string" &&
    typeof recommendation.stopping_condition === "string" &&
    typeof recommendation.reason === "string" &&
    typeof recommendation.strategy_name === "string" &&
    typeof recommendation.strategy_version === "string" &&
    (recommendation.state === "proposed" ||
      recommendation.state === "accepted" ||
      recommendation.state === "closed") &&
    typeof recommendation.created_at === "string" &&
    Array.isArray(recommendation.explanation_factors)
  );
}

async function recommendationResponse(response: Response): Promise<Recommendation> {
  if (!response.ok) {
    throw new Error(`Recommendation request failed with status ${response.status}`);
  }
  const responseBody: unknown = await response.json();
  if (!isRecommendation(responseBody)) {
    throw new Error("Recommendation response did not match the expected shape");
  }
  return responseBody;
}

export async function getCurrentRecommendation(
  signal?: AbortSignal,
): Promise<Recommendation | null> {
  const response = await fetch(`${apiBaseUrl}/recommendations/current`, {
    method: "GET",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Recommendation request failed with status ${response.status}`);
  }
  const responseBody: unknown = await response.json();
  if (responseBody === null) return null;
  if (!isRecommendation(responseBody)) {
    throw new Error("Recommendation response did not match the expected shape");
  }
  return responseBody;
}

export async function createRecommendation(
  signal: AbortSignal = AbortSignal.timeout(RECOMMENDATION_REQUEST_TIMEOUT_MS),
): Promise<Recommendation> {
  const response = await fetch(`${apiBaseUrl}/recommendations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ context: {} }),
    signal,
  });
  return recommendationResponse(response);
}

export async function recordRecommendationEvent(
  recommendationId: string,
  eventType: EpisodeEventType,
  signal: AbortSignal = AbortSignal.timeout(RECOMMENDATION_REQUEST_TIMEOUT_MS),
): Promise<RecommendationTransition> {
  const response = await fetch(
    `${apiBaseUrl}/recommendations/${recommendationId}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: eventType }),
      signal,
    },
  );
  if (!response.ok) {
    throw new Error(`Recommendation response failed with status ${response.status}`);
  }
  const responseBody: unknown = await response.json();
  if (typeof responseBody !== "object" || responseBody === null) {
    throw new Error("Recommendation transition did not match the expected shape");
  }
  const transition = responseBody as Record<string, unknown>;
  const event = transition.event as Record<string, unknown> | null;
  if (
    event === null ||
    typeof event !== "object" ||
    typeof event.id !== "string" ||
    typeof event.episode_id !== "string" ||
    typeof event.event_type !== "string" ||
    !isRecommendation(transition.episode) ||
    !(transition.replacement === null || isRecommendation(transition.replacement))
  ) {
    throw new Error("Recommendation transition did not match the expected shape");
  }
  return responseBody as RecommendationTransition;
}
