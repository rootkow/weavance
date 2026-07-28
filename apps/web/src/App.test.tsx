import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

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

  it("loads confirmed tasks without displaying the full list by default", async () => {
    const confirmedInterpretation = {
      ...interpretation,
      id: "2ed72150-36e9-4682-ad27-db1031b77de9",
      version: 2,
      status: "confirmed",
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(jsonResponse(tasksFromInterpretations(confirmedInterpretation), 200)),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "What’s taking up space right now?" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Update my resume" })).not.toBeInTheDocument();
    expect(screen.getByText("2 existing tasks are safely stored.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View all tasks" }));

    expect(
      await screen.findByRole("heading", { name: "Here’s what’s on your plate." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Update my resume" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Do laundry" })).toBeInTheDocument();
    expect(screen.getByText("2 tasks")).toBeInTheDocument();
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
      .mockResolvedValueOnce(jsonResponse(completedTask, 200))
      .mockResolvedValueOnce(jsonResponse(reopenedTask, 200))
      .mockResolvedValueOnce(jsonResponse(archivedTask, 200));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await screen.findByText("1 existing task is safely stored.");
    fireEvent.click(screen.getByRole("button", { name: "View all tasks" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));

    expect(await screen.findByText("Completed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/tasks/${activeTask.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
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
    const fetchMock = successfulFlowFetch()
      .mockResolvedValueOnce(jsonResponse(firstConfirmation))
      .mockResolvedValueOnce(
        jsonResponse(tasksFromInterpretations(firstConfirmation), 200),
      )
      .mockResolvedValueOnce(jsonResponse(secondCapture))
      .mockResolvedValueOnce(jsonResponse(secondInterpretation))
      .mockResolvedValueOnce(jsonResponse(secondConfirmation))
      .mockResolvedValueOnce(
        jsonResponse(
          tasksFromInterpretations(firstConfirmation, secondConfirmation),
          200,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await submitBrainDump();
    fireEvent.click(screen.getByRole("button", { name: "Looks right" }));
    await screen.findByRole("heading", { name: "That’s safely added." });
    fireEvent.click(screen.getByRole("button", { name: "Add another brain dump" }));

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

    await screen.findByRole("heading", { name: "That’s safely added." });
    expect(screen.queryByRole("heading", { name: "Update my resume" })).not.toBeInTheDocument();
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(tasksFromInterpretations(firstConfirmation, secondConfirmation), 200),
      )
      .mockResolvedValueOnce(jsonResponse(capture))
      .mockResolvedValueOnce(jsonResponse(interpretation))
      .mockResolvedValueOnce(jsonResponse(updatedFirstConfirmation))
      .mockResolvedValueOnce(
        jsonResponse(
          tasksFromInterpretations(updatedFirstConfirmation, secondConfirmation),
          200,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await submitBrainDump();
    fireEvent.click(screen.getByRole("button", { name: "Looks right" }));
    await screen.findByRole("heading", { name: "That’s safely added." });
    fireEvent.click(screen.getByRole("button", { name: "View all tasks" }));

    expect(
      screen.getAllByRole("heading", { level: 2 }).map(({ textContent }) => textContent),
    ).toEqual(["Update backend resume bullets", "Do laundry", "Schedule the dentist"]);
  });
});
