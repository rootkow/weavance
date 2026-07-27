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

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function successfulFlowFetch() {
  return vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(capture))
    .mockResolvedValueOnce(jsonResponse(interpretation));
}

async function submitBrainDump() {
  fireEvent.change(screen.getByLabelText("Brain dump"), {
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
      1,
      "/captures",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ raw_text: capture.raw_text }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
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
    );
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
      await screen.findByRole("heading", { name: "Got it. That’s a clearer picture." }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    render(<App />);

    const textArea = screen.getByLabelText("Brain dump");
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
        .mockResolvedValueOnce(jsonResponse(capture))
        .mockReturnValueOnce(pendingInterpretation),
    );
    render(<App />);

    fireEvent.change(screen.getByLabelText("Brain dump"), {
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
      .mockResolvedValueOnce(jsonResponse(capture))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(interpretation));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.change(screen.getByLabelText("Brain dump"), {
      target: { value: capture.raw_text },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save brain dump" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your brain dump is safe.");
    fireEvent.click(screen.getByRole("button", { name: "Try organizing again" }));

    expect(
      await screen.findByRole("heading", { name: "Here’s what I pulled out." }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keeps submission unavailable until the brain dump has visible text", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    const submitButton = screen.getByRole("button", { name: "Save brain dump" });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Brain dump"), {
      target: { value: " \n\t " },
    });

    expect(submitButton).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Brain dump")).toHaveAttribute("maxLength", "50000");
  });

  it("keeps the draft available when the capture response is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ id: "capture-with-missing-fields" }),
      ),
    );
    render(<App />);

    const textArea = screen.getByLabelText("Brain dump");
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
});
