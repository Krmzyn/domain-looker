import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app.js";
import { createRdapChecker } from "./rdapService.js";
import { createDemoChecker } from "./demoService.js";

// Load a local .env file if present, using Node's built-in loader (no dependency).
// A missing file is fine — every variable is optional.
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // No .env file present; continue with process defaults.
  }
}

const demoMode =
  process.argv.includes("--demo") ||
  process.env.DOMAIN_LOOKER_DEMO === "1" ||
  process.env.DOMAIN_LOOKER_DEMO === "true";

const app = createApp(demoMode ? createDemoChecker() : createRdapChecker());
const port = Number(process.env.PORT ?? 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distPath = path.join(projectRoot, "dist");
const indexPath = path.join(distPath, "index.html");

if (existsSync(indexPath)) {
  app.use(express.static(distPath));
  app.get("*", (_request, response) => {
    response.sendFile(indexPath);
  });
}

app.listen(port, () => {
  const mode = demoMode ? " (demo mode — simulated results)" : "";
  console.log(`Domain Looker API listening on http://127.0.0.1:${port}${mode}`);
});
