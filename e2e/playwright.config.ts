// The audit starts its own server by default: e2e/serve.ts builds the board page and serves it.
// Set AUDIT_URL to audit an app that is already running, or AUDIT_SERVER to start it another way.
import { defineConfig } from "@playwright/test";

const appUrl = process.env.AUDIT_URL ?? "http://localhost:3017";
const startCommand = process.env.AUDIT_SERVER ?? "bun e2e/serve.ts 3017";

export default defineConfig({
  testDir: ".",
  testMatch: "text-audit.spec.ts",
  reporter: "list",
  use: {
    // biome-ignore lint/style/useNamingConvention: baseURL is the name Playwright requires
    baseURL: appUrl,
    trace: "off",
    launchOptions: process.env.AUDIT_CHROMIUM ? { executablePath: process.env.AUDIT_CHROMIUM } : {},
  },
  webServer: { command: startCommand, url: appUrl, cwd: "..", reuseExistingServer: true },
});
