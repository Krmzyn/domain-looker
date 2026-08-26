// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("checks pasted domains and renders result rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                originalInput: "example.com",
                normalizedDomain: "example.com",
                tld: "com",
                status: "likely_available",
                availabilityGuess: "Likely available, not guaranteed",
                registrar: "",
                nameservers: [],
                notes: "RDAP returned 404 not found.",
                checkedAt: "2026-06-04T12:00:00.000Z",
                fromCache: false
              }
            ],
            summary: {
              registered: 0,
              likely_available: 1,
              invalid_domain: 0,
              unsupported_tld: 0,
              rate_limited: 0,
              unknown_error: 0
            },
            duplicateCount: 0,
            checkedCount: 1,
            bootstrapPublication: "2026-05-20T18:00:00Z",
            warnings: []
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    render(<App />);
    const user = userEvent.setup();
    const textarea = screen.getByLabelText(/domains and urls/i);

    await user.clear(textarea);
    await user.type(textarea, "example.com");
    await user.click(screen.getByRole("button", { name: /check rdap/i }));

    await waitFor(() => expect(screen.getAllByText("example.com").length).toBeGreaterThanOrEqual(2));
    expect(screen.getAllByText("Likely available").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/1 unique rows checked/i).textContent).toContain("1 unique rows checked");
  });

  it("clears input and results", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /clear input and results/i }));

    expect((screen.getByLabelText(/domains and urls/i) as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText(/no rows to show/i).textContent).toContain("No rows to show");
  });
});
