import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import type { Recommendation } from "./api/recommendations";

const capture = {
  id: "a127eea6-fc28-447c-a990-04ee6487de09",
  raw_text: "  Update my resume\nDo laundry  ",
  created_at: "2026-07-23T20:00:00Z",
};

const interpretation = {
  id: "7375bf2c-43a5-466c-a3a9-8e6107310fb7",
  capture_id: capture.id,
  parent_interpretation_id: null,
  version: 1,
  status: "proposed",
  reference_time: "2026-07-27T10:00:00Z",
  time_zone: "UTC",
  created_at: "2026-07-27T10:00:00Z",
  proposal: {
    schema_version: "1",
    capture_id: capture.id,
    interpreter: { name: "line-based-fallback", version: "1" },
    tasks: [
      {
        id: "c9a84b03-1b40-442e-acd1-0f15fa0b39b8",
        title: "Update my resume",
        provenance: {
          evidence_source: "user_text",
          derivation: "rule",
          confidence: 1,
        },
        actions: [
          {
            id: "76056d5b-2bbb-46f7-b2ed-1d18a9efe7c7",
            description: "Update my resume",
            provenance: {
              evidence_source: "user_text",
              derivation: "rule",
              confidence: 1,
            },
          },
        ],
      },
      {
        id: "f1949cf1-3df5-4159-8769-6b4d27744e08",
        title: "Do laundry",
        provenance: {
          evidence_source: "user_text",
          derivation: "rule",
          confidence: 1,
        },
        actions: [
          {
            id: "e7ee5fd4-b3f7-4b80-adb7-0c450726b7de",
            description: "Do laundry",
            provenance: {
              evidence_source: "user_text",
              derivation: "rule",
              confidence: 1,
            },
          },
        ],
      },
    ],
  },
};

interface TestInterpretation {
  id: string;
  capture_id: string;
  created_at: string;
  proposal: {
    tasks: Array<{
      id: string;
      title: string;
      provenance: object;
      deadline?: object | null;
      actions: Array<{
        id: string;
        description: string;
        provenance: object;
        duration?: object | null;
      }>;
    }>;
  };
}

function tasksFromInterpretations(...confirmedInterpretations: TestInterpretation[]) {
  return confirmedInterpretations.flatMap((confirmed) =>
    confirmed.proposal.tasks.map((task) => ({
      id: task.id,
      source_capture_id: confirmed.capture_id,
      source_interpretation_id: confirmed.id,
      title: task.title,
      status: "active",
      provenance: task.provenance,
      deadline: "deadline" in task ? task.deadline : null,
      importance: null,
      created_at: confirmed.created_at,
      updated_at: confirmed.created_at,
      actions: task.actions.map((action, actionIndex) => ({
        id: action.id,
        task_id: task.id,
        source_interpretation_id: confirmed.id,
        description: action.description,
        status: "active",
        position: actionIndex + 1,
        provenance: action.provenance,
        duration: "duration" in action ? action.duration : null,
        created_at: confirmed.created_at,
        updated_at: confirmed.created_at,
      })),
    })),
  );
}

function recommendationForTask(
  task: ReturnType<typeof tasksFromInterpretations>[number],
  state: "proposed" | "accepted" | "closed" = "proposed",
): Recommendation {
  return {
    id: `recommendation-${task.id}`,
    task_id: task.id,
    action_id: task.actions[0].id,
    parent_episode_id: null,
    task_title: task.title,
    action_description: task.actions[0].description,
    entry_point: task.actions[0].description,
    stopping_condition: `You have completed this starting action. “${task.title}” can remain open.`,
    context_snapshot: {
      available_minutes: null,
      easier_requested: false,
      constraints: [],
    },
    explanation_factors: [
      { kind: "fallback", value: "stable_active_starting_action" },
    ],
    reason: "This is an active starting action, kept to one bounded commitment.",
    strategy_name: "transparent-bounded-action",
    strategy_version: "1",
    state,
    created_at: "2026-07-30T14:00:00Z",
  };
}

function recommendationTransition(
  recommendation: Recommendation,
  eventType:
    | "accepted"
    | "resized"
    | "deferred"
    | "swapped"
    | "overwhelmed"
    | "done_for_now"
    | "progress_made"
    | "did_not_start"
    | "keep_going",
  replacement: Recommendation | null = null,
) {
  return {
    event: {
      id: `event-${eventType}`,
      episode_id: recommendation.id,
      event_type: eventType,
      payload: {},
      created_at: "2026-07-30T14:01:00Z",
    },
    episode: {
      ...recommendation,
      state: eventType === "accepted" ? "accepted" : "closed",
    },
    replacement,
  };
}

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function successfulFlowFetch() {
  return vi
    .fn()
    .mockResolvedValueOnce(jsonResponse([], 200))
    .mockResolvedValueOnce(jsonResponse(capture))
    .mockResolvedValueOnce(jsonResponse(interpretation));
}

async function submitBrainDump() {
  fireEvent.change(await screen.findByLabelText("Brain dump"), {
    target: { value: capture.raw_text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save brain dump" }));
  await screen.findByRole("heading", { name: "Here’s what I pulled out." });
}

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves and presents a structured interpretation for review", async () => {
    const fetchMock = successfulFlowFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await submitBrainDump();

    expect(screen.getByLabelText("Task 1 title")).toHaveValue("Update my resume");
    expect(screen.getByLabelText("Task 2 title")).toHaveValue("Do laundry");
    expect(screen.getByText("2 tasks")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/captures",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ raw_text: capture.raw_text }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/captures/${capture.id}/interpretations`,
      expect.objectContaining({
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("persists edits and removals as a confirmed version", async () => {
    const confirmedInterpretation = {
      ...interpretation,
      id: "2ed72150-36e9-4682-ad27-db1031b77de9",
      version: 2,
      status: "confirmed",
    };
    const fetchMock = successfulFlowFetch().mockResolvedValueOnce(
      jsonResponse(confirmedInterpretation),
    ).mockResolvedValueOnce(jsonResponse(tasksFromInterpretations(confirmedInterpretation), 200));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await submitBrainDump();

    fireEvent.change(screen.getByLabelText("Task 1 title"), {
      target: { value: "Update backend resume bullets" },
    });
    fireEvent.change(screen.getByLabelText("Task 1 starting point"), {
      target: { value: "Open the resume and revise one backend bullet" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove Do laundry" }));
    fireEvent.click(screen.getByRole("button", { name: "Looks right" }));

    expect(
      await screen.findByRole("heading", { name: "That’s safely added." }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Update my resume" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View all tasks" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      `/captures/${capture.id}/interpretations/${interpretation.id}/confirm`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          tasks: [
            {
              id: interpretation.proposal.tasks[0].id,
              title: "Update backend resume bullets",
              action_id: interpretation.proposal.tasks[0].actions[0].id,
              action_description: "Open the resume and revise one backend bullet",
            },
          ],
        }),
      }),
    );
  });

  it("lets the user add a task the first pass missed", async () => {
    const fetchMock = successfulFlowFetch();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await submitBrainDump();
    fireEvent.click(screen.getByRole("button", { name: "Add another task" }));

    expect(screen.getByText("3 tasks")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Task 3 title"), {
      target: { value: "Pick up a prescription" },
    });
    fireEvent.change(screen.getByLabelText("Task 3 starting point"), {
      target: { value: "Check when the pharmacy closes" },
    });

    expect(screen.getByRole("button", { name: "Looks right" })).toBeEnabled();
  });

  it("keeps the draft available when saving the capture fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse([], 200))
        .mockResolvedValueOnce(new Response(null, { status: 503 })),
    );
    render(<App />);

    const textArea = await screen.findByLabelText("Brain dump");
    fireEvent.change(textArea, {
      target: { value: "Call the dentist" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save brain dump" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your words are still here.");
    expect(textArea).toHaveValue("Call the dentist");
    expect(screen.getByRole("button", { name: "Try saving again" })).toBeEnabled();
  });

  it("shows a processing state after the capture is saved", async () => {
    let resolveInterpretation: ((response: Response) => void) | undefined;
    const pendingInterpretation = new Promise<Response>((resolve) => {
      resolveInterpretation = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse([], 200))
        .mockResolvedValueOnce(jsonResponse(capture))
        .mockReturnValueOnce(pendingInterpretation),
    );
    render(<App />);

    fireEvent.change(await screen.findByLabelText("Brain dump"), {
      target: { value: capture.raw_text },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save brain dump" }));

    expect(
      await screen.findByRole("heading", { name: "Making a first pass…" }),
    ).toBeInTheDocument();

    resolveInterpretation?.(jsonResponse(interpretation));
    expect(
      await screen.findByRole("heading", { name: "Here’s what I pulled out." }),
    ).toBeInTheDocument();
  });

  it("can retry interpretation without losing a successfully saved capture", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([], 200))
      .mockResolvedValueOnce(jsonResponse(capture))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(interpretation));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(await screen.findByLabelText("Brain dump"), {
      target: { value: capture.raw_text },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save brain dump" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your brain dump is safe.");
    fireEvent.click(screen.getByRole("button", { name: "Try organizing again" }));

    expect(
      await screen.findByRole("heading", { name: "Here’s what I pulled out." }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("keeps submission unavailable until the brain dump has visible text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([], 200));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    const submitButton = await screen.findByRole("button", { name: "Save brain dump" });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Brain dump"), {
      target: { value: " \n\t " },
    });

    expect(submitButton).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Brain dump")).toHaveAttribute("maxLength", "50000");
  });

  it("keeps the draft available when the capture response is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse([], 200))
        .mockResolvedValueOnce(jsonResponse({ id: "capture-with-missing-fields" })),
    );
    render(<App />);

    const textArea = await screen.findByLabelText("Brain dump");
    fireEvent.change(textArea, {
      target: { value: "Call the dentist" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save brain dump" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your words are still here.");
    expect(textArea).toHaveValue("Call the dentist");
  });

  it("keeps review edits when confirmation fails", async () => {
    const fetchMock = successfulFlowFetch().mockResolvedValueOnce(
      new Response(null, { status: 503 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await submitBrainDump();
    fireEvent.change(screen.getByLabelText("Task 1 title"), {
      target: { value: "Update my backend resume" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Looks right" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your edits are still here.");
    expect(screen.getByDisplayValue("Update my backend resume")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Looks right" })).toBeEnabled();
    });
  });

  it("keeps a successful confirmation saved when the task refresh fails", async () => {
    const confirmedInterpretation = {
      ...interpretation,
      id: "2ed72150-36e9-4682-ad27-db1031b77de9",
      version: 2,
      status: "confirmed",
    };
    const fetchMock = successfulFlowFetch()
      .mockResolvedValueOnce(jsonResponse(confirmedInterpretation))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await submitBrainDump();
    fireEvent.click(screen.getByRole("button", { name: "Looks right" }));

    expect(
      await screen.findByRole("heading", { name: "That’s safely added." }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your review is saved, but I couldn’t refresh the task list.",
    );
    expect(screen.queryByRole("button", { name: "Looks right" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("turns a recommendation into an active commitment and records Done for now", async () => {
    const confirmedInterpretation = {
      ...interpretation,
      id: "2ed72150-36e9-4682-ad27-db1031b77de9",
      version: 2,
      status: "confirmed",
    };
    const [activeTask] = tasksFromInterpretations(confirmedInterpretation);
    const proposedRecommendation = recommendationForTask(activeTask);
    const acceptedRecommendation = {
      ...proposedRecommendation,
      state: "accepted" as const,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([activeTask], 200))
      .mockResolvedValueOnce(jsonResponse(proposedRecommendation, 200))
      .mockResolvedValueOnce(
        jsonResponse(
          recommendationTransition(proposedRecommendation, "accepted"),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          recommendationTransition(acceptedRecommendation, "done_for_now"),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: activeTask.actions[0].description,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Why this?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(await screen.findByText("What happened?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Done for now.*I reached this stopping point/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /timer/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Done for now.*I reached this stopping point/,
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "You met this stopping point.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/applies to this bounded commitment/),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/recommendations/${proposedRecommendation.id}/events`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ event_type: "accepted" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      `/recommendations/${proposedRecommendation.id}/events`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ event_type: "done_for_now" }),
      }),
    );
  });

  it("restores an accepted commitment without inferring an outcome", async () => {
    const confirmedInterpretation = {
      ...interpretation,
      id: "2ed72150-36e9-4682-ad27-db1031b77de9",
      version: 2,
      status: "confirmed",
    };
    const [activeTask] = tasksFromInterpretations(confirmedInterpretation);
    const acceptedRecommendation = recommendationForTask(activeTask, "accepted");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse([activeTask], 200))
        .mockResolvedValueOnce(jsonResponse(acceptedRecommendation, 200)),
    );
    render(<App />);

    expect(await screen.findByText("Your commitment")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Choose only when you’re ready. Until then, Weavance won’t assume an outcome.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/does not mark/)).toBeInTheDocument();
  });

  it("reduces decisions after the user reports feeling overwhelmed", async () => {
    const confirmedInterpretation = {
      ...interpretation,
      id: "2ed72150-36e9-4682-ad27-db1031b77de9",
      version: 2,
      status: "confirmed",
    };
    const [activeTask] = tasksFromInterpretations(confirmedInterpretation);
    const proposedRecommendation = recommendationForTask(activeTask);
    const preparationRecommendation = {
      ...recommendationForTask(activeTask),
      id: `overwhelmed-${activeTask.id}`,
      parent_episode_id: proposedRecommendation.id,
      entry_point: `Put the first thing you need for “${activeTask.actions[0].description}” in front of you.`,
      stopping_condition:
        "The relevant app, document, object, or contact is ready. Nothing else is required.",
      explanation_factors: [
        { kind: "explicit_response", value: "overwhelmed" },
      ],
      reason:
        "You asked for less to decide, so this is only a preparation step.",
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse([activeTask], 200))
        .mockResolvedValueOnce(jsonResponse(proposedRecommendation, 200))
        .mockResolvedValueOnce(
          jsonResponse(
            recommendationTransition(
              proposedRecommendation,
              "overwhelmed",
              preparationRecommendation,
            ),
          ),
        ),
    );
    render(<App />);

    await screen.findByText("One bounded step");
    fireEvent.click(screen.getByRole("button", { name: "I’m overwhelmed" }));

    expect(await screen.findByText("Only a preparation step")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause here" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Different task" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View all tasks" }),
    ).not.toBeInTheDocument();
  });

  it("loads one recommendation instead of displaying the full task list by default", async () => {
    const confirmedInterpretation = {
      ...interpretation,
      id: "2ed72150-36e9-4682-ad27-db1031b77de9",
      version: 2,
      status: "confirmed",
    };
    const savedTasks = tasksFromInterpretations(confirmedInterpretation);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(savedTasks, 200))
        .mockResolvedValueOnce(
          jsonResponse(recommendationForTask(savedTasks[0]), 200),
        ),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Update my resume" }),
    ).toBeInTheDocument();
    expect(screen.getByText("One bounded step")).toBeInTheDocument();
    expect(screen.getByText("You’re done when")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Do laundry" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View all tasks" }));

    expect(
      await screen.findByRole("heading", { name: "Here’s what’s on your plate." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Update my resume" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Do laundry" })).toBeInTheDocument();
    expect(screen.getByText("2 tasks")).toBeInTheDocument();
  });

  it("edits a saved task and its starting action together", async () => {
    const confirmedInterpretation = {
      ...interpretation,
      id: "2ed72150-36e9-4682-ad27-db1031b77de9",
      version: 2,
      status: "confirmed",
    };
    const [activeTask] = tasksFromInterpretations(confirmedInterpretation);
    const updatedTask = {
      ...activeTask,
      title: "Update resume for backend roles",
      updated_at: "2026-07-30T10:00:00Z",
      actions: [
        {
          ...activeTask.actions[0],
          description: "Revise one backend resume bullet",
          updated_at: "2026-07-30T10:00:00Z",
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([activeTask], 200))
      .mockResolvedValueOnce(
        jsonResponse(recommendationForTask(activeTask), 200),
      )
      .mockResolvedValueOnce(jsonResponse(updatedTask, 200));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await screen.findByText("One bounded step");
    fireEvent.click(screen.getByRole("button", { name: "View all tasks" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: updatedTask.title },
    });
    fireEvent.change(screen.getByLabelText("Starting action"), {
      target: { value: updatedTask.actions[0].description },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByRole("heading", { name: updatedTask.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(updatedTask.actions[0].description)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/tasks/${activeTask.id}/content`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          title: updatedTask.title,
          action_id: activeTask.actions[0].id,
          action_description: updatedTask.actions[0].description,
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("completes, reopens, and archives canonical tasks explicitly", async () => {
    const confirmedInterpretation = {
      ...interpretation,
      id: "2ed72150-36e9-4682-ad27-db1031b77de9",
      version: 2,
      status: "confirmed",
    };
    const [activeTask] = tasksFromInterpretations(confirmedInterpretation);
    const completedTask = { ...activeTask, status: "completed" };
    const reopenedTask = { ...activeTask, status: "active" };
    const archivedTask = { ...activeTask, status: "archived" };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([activeTask], 200))
      .mockResolvedValueOnce(
        jsonResponse(recommendationForTask(activeTask), 200),
      )
      .mockResolvedValueOnce(jsonResponse(completedTask, 200))
      .mockResolvedValueOnce(jsonResponse(reopenedTask, 200))
      .mockResolvedValueOnce(jsonResponse(archivedTask, 200));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await screen.findByText("One bounded step");
    fireEvent.click(screen.getByRole("button", { name: "View all tasks" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));

    expect(await screen.findByText("Completed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/tasks/${activeTask.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
        signal: expect.any(AbortSignal),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    await waitFor(() => {
      expect(screen.queryByText("Completed")).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: activeTask.title })).not.toBeInTheDocument();
    });
    expect(screen.getByText("Nothing actionable is on your list yet.")).toBeInTheDocument();
  });

  it("uses the canonical task returned by a lifecycle update", async () => {
    const confirmedInterpretation = {
      ...interpretation,
      id: "2ed72150-36e9-4682-ad27-db1031b77de9",
      version: 2,
      status: "confirmed",
    };
    const [activeTask] = tasksFromInterpretations(confirmedInterpretation);
    const canonicalTask = { ...activeTask, status: "completed" };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse([activeTask], 200))
        .mockResolvedValueOnce(
          jsonResponse(recommendationForTask(activeTask), 200),
        )
        .mockResolvedValueOnce(jsonResponse(canonicalTask, 200)),
    );
    render(<App />);

    await screen.findByText("One bounded step");
    fireEvent.click(screen.getByRole("button", { name: "View all tasks" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    expect(await screen.findByText("Completed")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: activeTask.title })).toBeInTheDocument();
  });

  it("adds tasks from another brain dump without replacing the current list", async () => {
    const firstConfirmation = {
      ...interpretation,
      id: "2ed72150-36e9-4682-ad27-db1031b77de9",
      version: 2,
      status: "confirmed",
    };
    const secondCapture = {
      id: "215a7c0f-42bb-4752-8654-cc06e247328d",
      raw_text: "Schedule the dentist",
      created_at: "2026-07-27T21:00:00Z",
    };
    const secondInterpretation = {
      ...interpretation,
      id: "a46ec3c0-b497-4f24-a795-845016578e97",
      capture_id: secondCapture.id,
      version: 1,
      proposal: {
        ...interpretation.proposal,
        capture_id: secondCapture.id,
        tasks: [
          {
            ...interpretation.proposal.tasks[0],
            id: "a2fa9ea7-b55c-4f0e-a74c-83e35ca552d8",
            title: "Schedule the dentist",
            actions: [
              {
                ...interpretation.proposal.tasks[0].actions[0],
                id: "fddff5a1-b392-49d9-90fd-146bc011b4d2",
                description: "Call the dentist",
              },
            ],
          },
        ],
      },
    };
    const secondConfirmation = {
      ...secondInterpretation,
      id: "5596b7c9-2e3e-485f-97eb-e23d8b371896",
      version: 2,
      status: "confirmed",
    };
    const firstTasks = tasksFromInterpretations(firstConfirmation);
    const allTasks = tasksFromInterpretations(firstConfirmation, secondConfirmation);
    const firstRecommendation = recommendationForTask(firstTasks[0]);
    const fetchMock = successfulFlowFetch()
      .mockResolvedValueOnce(jsonResponse(firstConfirmation))
      .mockResolvedValueOnce(jsonResponse(firstTasks, 200))
      .mockResolvedValueOnce(jsonResponse(firstRecommendation))
      .mockResolvedValueOnce(jsonResponse(secondCapture))
      .mockResolvedValueOnce(jsonResponse(secondInterpretation))
      .mockResolvedValueOnce(jsonResponse(secondConfirmation))
      .mockResolvedValueOnce(jsonResponse(allTasks, 200))
      .mockResolvedValueOnce(jsonResponse(firstRecommendation));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await submitBrainDump();
    fireEvent.click(screen.getByRole("button", { name: "Looks right" }));
    await screen.findByText("That’s added. Here’s one place to begin");
    fireEvent.click(screen.getByRole("button", { name: "Add a brain dump" }));

    expect(
      screen.getByText("2 existing tasks are safely stored."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Brain dump"), {
      target: { value: secondCapture.raw_text },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save brain dump" }));

    await screen.findByRole("heading", { name: "Here’s what I pulled out." });
    expect(
      screen.getByText("Your 2 existing tasks stay on your list while you review these."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Looks right" }));

    await screen.findByText("That’s added. Here’s one place to begin");
    fireEvent.click(screen.getByRole("button", { name: "View all tasks" }));

    await screen.findByText("3 tasks");
    expect(screen.getByRole("heading", { name: "Update my resume" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Do laundry" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Schedule the dentist" }),
    ).toBeInTheDocument();
  });

  it("preserves capture ordering when replacing a confirmed interpretation", async () => {
    const firstConfirmation = {
      ...interpretation,
      id: "2ed72150-36e9-4682-ad27-db1031b77de9",
      version: 2,
      status: "confirmed",
    };
    const secondCapture = {
      id: "215a7c0f-42bb-4752-8654-cc06e247328d",
      raw_text: "Schedule the dentist",
      created_at: "2026-07-27T21:00:00Z",
    };
    const secondConfirmation = {
      ...firstConfirmation,
      id: "5596b7c9-2e3e-485f-97eb-e23d8b371896",
      capture_id: secondCapture.id,
      proposal: {
        ...firstConfirmation.proposal,
        capture_id: secondCapture.id,
        tasks: [
          {
            ...firstConfirmation.proposal.tasks[0],
            id: "a2fa9ea7-b55c-4f0e-a74c-83e35ca552d8",
            title: "Schedule the dentist",
            actions: [
              {
                ...firstConfirmation.proposal.tasks[0].actions[0],
                id: "fddff5a1-b392-49d9-90fd-146bc011b4d2",
                description: "Call the dentist",
              },
            ],
          },
        ],
      },
    };
    const updatedFirstConfirmation = {
      ...firstConfirmation,
      id: "25e58f53-180d-475d-8025-c43eb78e2bb7",
      version: 3,
      proposal: {
        ...firstConfirmation.proposal,
        tasks: [
          {
            ...firstConfirmation.proposal.tasks[0],
            title: "Update backend resume bullets",
          },
          firstConfirmation.proposal.tasks[1],
        ],
      },
    };
    const initialTasks = tasksFromInterpretations(firstConfirmation, secondConfirmation);
    const updatedTasks = tasksFromInterpretations(
      updatedFirstConfirmation,
      secondConfirmation,
    );
    const existingRecommendation = recommendationForTask(initialTasks[0]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(initialTasks, 200))
      .mockResolvedValueOnce(jsonResponse(existingRecommendation, 200))
      .mockResolvedValueOnce(jsonResponse(capture))
      .mockResolvedValueOnce(jsonResponse(interpretation))
      .mockResolvedValueOnce(jsonResponse(updatedFirstConfirmation))
      .mockResolvedValueOnce(jsonResponse(updatedTasks, 200))
      .mockResolvedValueOnce(jsonResponse(existingRecommendation));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await screen.findByText("One bounded step");
    fireEvent.click(screen.getByRole("button", { name: "Add a brain dump" }));
    await submitBrainDump();
    fireEvent.click(screen.getByRole("button", { name: "Looks right" }));
    await screen.findByText("That’s added. Here’s one place to begin");
    fireEvent.click(screen.getByRole("button", { name: "View all tasks" }));

    expect(
      screen.getAllByRole("heading", { level: 2 }).map(({ textContent }) => textContent),
    ).toEqual(["Update backend resume bullets", "Do laundry", "Schedule the dentist"]);
  });
});
