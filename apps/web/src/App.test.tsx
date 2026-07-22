import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("turns a brain dump into a temporary next action", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Brain dump"), {
      target: { value: "Update my resume and do laundry" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Help me choose" }));

    expect(screen.getByText("A manageable beginning")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });
});
