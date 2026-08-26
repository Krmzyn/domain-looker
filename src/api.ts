import type { CheckResponse } from "./types";

export async function checkDomains(inputs: string[]): Promise<CheckResponse> {
  const response = await fetch("/api/check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Domain check failed.");
  }

  return payload as CheckResponse;
}
