import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    pool: "threads",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
      include: [
        "src/commands/**/*.ts",
        "src/config/**/*.ts",
        "src/extraction/**/*.ts",
        "src/utils/**/*.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/__mocks__/**",
        "src/types.ts",
        "src/extension.ts",
        "src/ui/**",
        "src/telemetry/**",
        "src/config/settings.ts",
        "**/node_modules/**",
        "**/dist/**",
        "**/coverage/**",
        "**/release/**",
        "**/docs/**",
        "**/*.config.*",
        "**/test/**",
      ],
    },
    include: ["src/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/release/**",
      "**/docs/**",
      "**/__mocks__/**",
      "**/test/**",
    ],
  },
  resolve: {
    alias: {
      vscode: "@vscode/test-electron",
    },
  },
});
