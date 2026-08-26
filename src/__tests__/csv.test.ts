import { describe, expect, it } from "vitest";
import { resultsToCsv } from "../csv";
import type { DomainResult } from "../types";

describe("resultsToCsv", () => {
  it("escapes commas and joins nameservers", () => {
    const result: DomainResult = {
      originalInput: "https://example.com",
      normalizedDomain: "example.com",
      tld: "com",
      status: "registered",
      availabilityGuess: "Registered",
      registrar: "Example, Inc.",
      nameservers: ["ns1.example.com", "ns2.example.com"],
      notes: "RDAP returned a domain object.",
      checkedAt: "2026-06-04T12:00:00.000Z",
      fromCache: true
    };

    const csv = resultsToCsv([result]);

    expect(csv).toContain('"Example, Inc."');
    expect(csv).toContain("ns1.example.com; ns2.example.com");
    expect(csv).toContain("yes");
  });
});
