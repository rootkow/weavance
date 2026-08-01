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

export interface RecommendationContextSnapshot {
  available_minutes: number | null;
  easier_requested: boolean;
  constraints: string[];
}

export interface RecommendationExplanationFactor {
  kind: string;
  value: string;
}

export interface Recommendation {
  id: string;
  task_id: string;
  action_id: string;
  parent_episode_id: string | null;
  task_title: string;
  action_description: string;
  entry_point: string;
  stopping_condition: string;
  context_snapshot: RecommendationContextSnapshot;
  explanation_factors: RecommendationExplanationFactor[];
  reason: string;
  strategy_name: string;
  strategy_version: string;
  state: RecommendationState;
  created_at: string;
}

export interface ReentryCheckpoint {
  id: string;
  task_id: string;
  action_id: string;
  source_episode_id: string;
  reentry_episode_id: string | null;
  entry_point: string;
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
  checkpoint: ReentryCheckpoint | null;
}

const RECOMMENDATION_REQUEST_TIMEOUT_MS = 15_000;
export const MAX_REENTRY_POINT_CHARACTERS = 500;
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isContextSnapshot(value: unknown): value is RecommendationContextSnapshot {
  if (!isRecord(value)) return false;
  const availableMinutes = value.available_minutes;
  return (
    (availableMinutes === null ||
      (typeof availableMinutes === "number" &&
        Number.isInteger(availableMinutes) &&
        availableMinutes > 0)) &&
    typeof value.easier_requested === "boolean" &&
    Array.isArray(value.constraints) &&
    value.constraints.every(
      (constraint) => typeof constraint === "string" && constraint.trim().length > 0,
    )
  );
}

function isExplanationFactor(
  value: unknown,
): value is RecommendationExplanationFactor {
  return (
    isRecord(value) &&
    typeof value.kind === "string" &&
    value.kind.trim().length > 0 &&
    typeof value.value === "string" &&
    value.value.trim().length > 0
  );
}

function isEpisodeEventType(value: unknown): value is EpisodeEventType {
  return (
    value === "accepted" ||
    value === "resized" ||
    value === "deferred" ||
    value === "swapped" ||
    value === "overwhelmed" ||
    value === "done_for_now" ||
    value === "progress_made" ||
    value === "did_not_start" ||
    value === "keep_going"
  );
}

function isReentryCheckpoint(value: unknown): value is ReentryCheckpoint {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.task_id === "string" &&
    typeof value.action_id === "string" &&
    typeof value.source_episode_id === "string" &&
    (value.reentry_episode_id === null ||
      typeof value.reentry_episode_id === "string") &&
    typeof value.entry_point === "string" &&
    value.entry_point.trim().length > 0 &&
    typeof value.created_at === "string"
  );
}

function isRecommendation(value: unknown): value is Recommendation {
  if (!isRecord(value)) return false;
  const recommendation = value;
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
    isContextSnapshot(recommendation.context_snapshot) &&
    Array.isArray(recommendation.explanation_factors) &&
    recommendation.explanation_factors.every(isExplanationFactor)
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
  details: { reentry_point?: string } = {},
  signal: AbortSignal = AbortSignal.timeout(RECOMMENDATION_REQUEST_TIMEOUT_MS),
): Promise<RecommendationTransition> {
  const response = await fetch(
    `${apiBaseUrl}/recommendations/${recommendationId}/events`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event_type: eventType, ...details }),
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
  const event = transition.event;
  if (
    !isRecord(event) ||
    typeof event.id !== "string" ||
    typeof event.episode_id !== "string" ||
    !isEpisodeEventType(event.event_type) ||
    !isRecord(event.payload) ||
    typeof event.created_at !== "string" ||
    !isRecommendation(transition.episode) ||
    !(transition.replacement === null || isRecommendation(transition.replacement)) ||
    !(
      transition.checkpoint === null ||
      isReentryCheckpoint(transition.checkpoint)
    )
  ) {
    throw new Error("Recommendation transition did not match the expected shape");
  }
  return responseBody as RecommendationTransition;
}
