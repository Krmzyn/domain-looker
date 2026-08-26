import { describe, expect, it } from "vitest";
import { normalizeInput } from "../normalization.js";

describe("normalizeInput", () => {
  it.each([
    ["https://example.com", "example.com", "com"],
    ["[www.example.ca/about](http://www.example.ca/about)", "example.ca", "ca"],
    ["example.io", "example.io", "io"],
    ["acme-tools.com", "acme-tools.com", "com"],
    ["https://shop.example.co.uk/path?x=1#section", "example.co.uk", "uk"],
    ["WWW.Example.Org/about", "example.org", "org"],
    ["https://bücher.de/kaufen", "xn--bcher-kva.de", "de"]
  ])("normalizes %s", (input, expectedDomain, expectedTld) => {
    const result = normalizeInput(input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.normalizedDomain).toBe(expectedDomain);
      expect(result.value.tld).toBe(expectedTld);
    }
  });

  it.each(["localhost", "http://127.0.0.1", "bad_domain.com", "-bad.com", "example..com", "just text"])(
    "rejects %s",
    (input) => {
      const result = normalizeInput(input);

      expect(result.ok).toBe(false);
    }
  );

  it("preserves syntactically valid domains whose TLD is not in the public suffix list", () => {
    const result = normalizeInput("brand.internalonly");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.normalizedDomain).toBe("brand.internalonly");
      expect(result.value.tld).toBe("internalonly");
    }
  });
});
