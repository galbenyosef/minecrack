import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: process.env.MINECRACK_TEST_URL || "http://127.0.0.1:5194",
    viewport: { width: 1536, height: 864 },
    channel: "chrome",
    headless: true,
    launchOptions: { args: ["--enable-webgl", "--ignore-gpu-blocklist"] },
  },
  reporter: "list",
});
