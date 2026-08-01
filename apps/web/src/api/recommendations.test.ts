import { afterEach, describe, expect, it, vi } from "vitest";

import { getCurrentRecommendation } from "./recommendations";

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
});
