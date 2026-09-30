import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:8081",
    viewport: { width: 390, height: 844 },
  },
  workers: 1,
});
