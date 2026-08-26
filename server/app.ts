import express from "express";
import { z } from "zod";
import { createRdapChecker } from "./rdapService.js";
import type { CheckResponse } from "./types.js";

const checkRequestSchema = z.object({
  inputs: z
    .array(z.string().trim().min(1))
    .min(1, "Paste at least one domain or URL.")
    .max(100, "A check can include up to 100 inputs.")
});

export interface DomainChecker {
  checkInputs(inputs: string[]): Promise<CheckResponse>;
}

export function createApp(checker: DomainChecker = createRdapChecker()) {
  const app = express();

  app.use(express.json({ limit: "80kb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.post("/api/check", async (request, response) => {
    const parsed = checkRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(400).json({
        error: parsed.error.issues.map((issue) => issue.message).join(" ")
      });
      return;
    }

    try {
      const result = await checker.checkInputs(parsed.data.inputs);
      response.json(result);
    } catch (error) {
      // Log the detail server-side, but return a generic message so no internal
      // error text (or filesystem paths) is ever exposed to the client.
      console.error("Domain check failed:", error);
      response.status(500).json({ error: "Domain check failed. Please try again." });
    }
  });

  return app;
}
