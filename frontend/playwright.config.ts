import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  use: {
    baseURL: process.env.TJW_BROWSER_BASE_URL ?? "http://127.0.0.1:8080",
  },
  reporter: "list",
});
