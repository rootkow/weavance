import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentRecommendation,
  recordRecommendationEvent,
} from "./recommendations";

const validRecommendation = {
  id: "7d84b307-1069-4a6c-8cee-33d32ba6ed65",
  task_id: "2c4f1193-ce55-49ec-a4ef-3d436ef62e20",
  action_id: "f01a5254-bf78-4f89-b6f2-cf51ac8d1647",
  parent_episode_id: null,
  task_title: "Update my resume",
  action_description: "Revise one resume bullet",
  entry_point: "Revise one resume bullet",
  stopping_condition: "You have completed this starting action.",
  context_snapshot: {
    available_minutes: null,
    easier_requested: false,
    constraints: [],
  },
  explanation_factors: [
    { kind: "fallback", value: "stable_active_starting_action" },
  ],
  reason: "This is an active starting action.",
  strategy_name: "transparent-bounded-action",
  strategy_version: "1",
  state: "proposed",
  created_at: "2026-08-01T10:00:00Z",
};

const validCheckpoint = {
  id: "9ee2fe65-77fe-42ae-bdbd-15c129a44637",
  task_id: validRecommendation.task_id,
  action_id: validRecommendation.action_id,
  source_episode_id: validRecommendation.id,
  reentry_episode_id: null,
  entry_point: "Open the draft and revise the next paragraph",
  created_at: "2026-08-01T10:05:00Z",
};

const validTransition = {
  event: {
    id: "1874e197-94f8-4340-8893-4efe8ad7749b",
    episode_id: validRecommendation.id,
    event_type: "progress_made",
    payload: { reentry_checkpoint_id: validCheckpoint.id },
    created_at: "2026-08-01T10:05:00Z",
  },
  episode: { ...validRecommendation, state: "closed" },
  replacement: null,
  checkpoint: validCheckpoint,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("recommendation response validation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts the complete recommendation contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(validRecommendation)));

    await expect(getCurrentRecommendation()).resolves.toEqual(validRecommendation);
  });

  it("rejects an incomplete context snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ...validRecommendation,
          context_snapshot: { available_minutes: null },
        }),
      ),
    );

    await expect(getCurrentRecommendation()).rejects.toThrow(
      "Recommendation response did not match the expected shape",
    );
  });

  it("rejects malformed explanation factors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ...validRecommendation,
          explanation_factors: [null],
        }),
      ),
    );

    await expect(getCurrentRecommendation()).rejects.toThrow(
      "Recommendation response did not match the expected shape",
    );
  });

  it("accepts a complete checkpoint transition", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(validTransition));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      recordRecommendationEvent(validRecommendation.id, "progress_made", {
        reentry_point: validCheckpoint.entry_point,
      }),
    ).resolves.toEqual(validTransition);
    expect(fetchMock).toHaveBeenCalledWith(
      `/recommendations/${validRecommendation.id}/events`,
      expect.objectContaining({
        body: JSON.stringify({
          event_type: "progress_made",
          reentry_point: validCheckpoint.entry_point,
        }),
      }),
    );
  });

  it("rejects malformed checkpoint transition data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ...validTransition,
          checkpoint: { ...validCheckpoint, entry_point: "" },
        }),
      ),
    );

    await expect(
      recordRecommendationEvent(validRecommendation.id, "progress_made"),
    ).rejects.toThrow(
      "Recommendation transition did not match the expected shape",
    );
  });
});
