import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits the original brain dump and confirms it was saved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "a127eea6-fc28-447c-a990-04ee6487de09",
          raw_text: "  Update my resume\nDo laundry  ",
          created_at: "2026-07-23T20:00:00Z",
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    const rawText = "  Update my resume\nDo laundry  ";
    fireEvent.change(screen.getByLabelText("Brain dump"), {
      target: { value: rawText },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save brain dump" }));

    expect(await screen.findByText("Your thoughts are saved.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/captures", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw_text: rawText }),
    });
  });

  it("keeps the draft available when saving fails", async () => {
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

  it("shows the saving state while the request is in progress", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const pendingRequest = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pendingRequest));
    render(<App />);

    fireEvent.change(screen.getByLabelText("Brain dump"), {
      target: { value: "Review tomorrow's calendar" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save brain dump" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    });
    expect(screen.getByLabelText("Brain dump")).toBeDisabled();

    resolveRequest?.(
      new Response(
        JSON.stringify({
          id: "a127eea6-fc28-447c-a990-04ee6487de09",
          raw_text: "Review tomorrow's calendar",
          created_at: "2026-07-23T20:00:00Z",
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    expect(await screen.findByText("Your thoughts are saved.")).toBeInTheDocument();
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
  });
});
