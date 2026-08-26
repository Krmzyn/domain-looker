import { describe, expect, it, vi } from "vitest";
import { createRdapChecker } from "../rdapService.js";

const bootstrapPayload = {
  publication: "2026-05-20T18:00:00Z",
  services: [[["com"], ["https://rdap.example.test/"]]]
};

describe("createRdapChecker", () => {
  it("maps RDAP 200 domain responses to registered and parses registrar/nameservers", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(bootstrapPayload))
      .mockResolvedValueOnce(
        jsonResponse({
          objectClassName: "domain",
          entities: [
            {
              roles: ["registrar"],
              handle: "292",
              vcardArray: ["vcard", [["fn", {}, "text", "Example Registrar Inc."]]]
            }
          ],
          nameservers: [{ ldhName: "NS1.EXAMPLE.COM" }, { ldhName: "ns2.example.com" }]
        })
      );

    const checker = createRdapChecker({ fetchImpl, now: fixedNow });
    const response = await checker.checkInputs(["https://www.example.com/path"]);

    expect(response.results[0]).toMatchObject({
      normalizedDomain: "example.com",
      tld: "com",
      status: "registered",
      registrar: "Example Registrar Inc.",
      nameservers: ["ns1.example.com", "ns2.example.com"],
      fromCache: false
    });
  });

  it("maps RDAP 404 to likely_available", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(bootstrapPayload)).mockResolvedValueOnce(new Response(null, { status: 404 }));
    const checker = createRdapChecker({ fetchImpl, now: fixedNow });

    const response = await checker.checkInputs(["available-example.com"]);

    expect(response.results[0].status).toBe("likely_available");
    expect(response.results[0].availabilityGuess).toContain("Likely available");
  });

  it("maps RDAP 429 to rate_limited with Retry-After notes", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(bootstrapPayload))
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "120" } }));
    const checker = createRdapChecker({ fetchImpl, now: fixedNow });

    const response = await checker.checkInputs(["example.com"]);

    expect(response.results[0].status).toBe("rate_limited");
    expect(response.results[0].notes).toContain("120");
  });

  it("maps missing bootstrap services to unsupported_tld", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(bootstrapPayload));
    const checker = createRdapChecker({ fetchImpl, now: fixedNow });

    const response = await checker.checkInputs(["brand.internalonly"]);

    expect(response.results[0].status).toBe("unsupported_tld");
  });

  it("does not fail the batch when one row is invalid", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(bootstrapPayload)).mockResolvedValueOnce(new Response(null, { status: 404 }));
    const checker = createRdapChecker({ fetchImpl, now: fixedNow });

    const response = await checker.checkInputs(["bad_domain.com", "example.com"]);

    expect(response.summary.invalid_domain).toBe(1);
    expect(response.summary.likely_available).toBe(1);
  });

  it("deduplicates normalized domains and serves recent results from cache", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(bootstrapPayload)).mockResolvedValueOnce(new Response(null, { status: 404 }));
    const checker = createRdapChecker({ fetchImpl, now: fixedNow });

    const first = await checker.checkInputs(["www.example.com", "https://example.com/path"]);
    const second = await checker.checkInputs(["example.com"]);

    expect(first.duplicateCount).toBe(1);
    expect(first.results).toHaveLength(1);
    expect(second.results[0].fromCache).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("uses stale bootstrap when refresh fails", async () => {
    let currentTime = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(bootstrapPayload))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const checker = createRdapChecker({
      fetchImpl,
      now: () => new Date(currentTime),
      bootstrapTtlMs: 1,
      resultTtlMs: 1
    });

    await checker.checkInputs(["first.com"]);
    currentTime = 10;
    const response = await checker.checkInputs(["second.com"]);

    expect(response.results[0].status).toBe("likely_available");
  });
});

function fixedNow() {
  return new Date("2026-06-04T12:00:00.000Z");
}

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}
