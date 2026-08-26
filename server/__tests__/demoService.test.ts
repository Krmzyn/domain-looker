import { describe, expect, it } from "vitest";
import { createDemoChecker } from "../demoService.js";

const fixedNow = () => new Date("2026-06-04T12:00:00.000Z");

describe("createDemoChecker", () => {
  it("returns simulated results without any network access", async () => {
    const checker = createDemoChecker({ now: fixedNow });

    const response = await checker.checkInputs(["example.com", "my-brand-idea-2026.com", "not a domain"]);

    expect(response.results).toHaveLength(3);
    expect(response.warnings[0]).toMatch(/demo mode/i);
    // A well-known domain is always reported as registered so the demo stays believable.
    expect(response.results[0]).toMatchObject({ normalizedDomain: "example.com", status: "registered" });
    // Unparseable input still surfaces as invalid, just like the real checker.
    expect(response.results[2].status).toBe("invalid_domain");
  });

  it("is deterministic and de-duplicates normalized domains", async () => {
    const checker = createDemoChecker({ now: fixedNow });

    const first = await checker.checkInputs(["https://www.example.org/path", "example.org"]);
    const second = await checker.checkInputs(["example.org"]);

    expect(first.duplicateCount).toBe(1);
    expect(first.results).toHaveLength(1);
    expect(second.results[0].status).toBe(first.results[0].status);
  });
});
