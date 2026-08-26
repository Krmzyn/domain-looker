import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { CheckResponse } from "../types.js";

describe("API", () => {
  it("validates the 100 input limit", async () => {
    const app = createApp({ checkInputs: vi.fn() });
    const response = await request(app)
      .post("/api/check")
      .send({ inputs: Array.from({ length: 101 }, (_, index) => `example${index}.com`) });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("up to 100");
  });

  it("returns checker responses", async () => {
    const checkResponse: CheckResponse = {
      results: [],
      summary: {
        registered: 0,
        likely_available: 0,
        invalid_domain: 0,
        unsupported_tld: 0,
        rate_limited: 0,
        unknown_error: 0
      },
      duplicateCount: 0,
      checkedCount: 0,
      bootstrapPublication: null,
      warnings: []
    };
    const app = createApp({ checkInputs: vi.fn().mockResolvedValue(checkResponse) });
    const response = await request(app).post("/api/check").send({ inputs: ["example.com"] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(checkResponse);
  });
});
