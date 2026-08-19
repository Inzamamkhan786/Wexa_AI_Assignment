import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  projects: [
    // ── Server-side tests (lib + API routes) ──────────────────────────────
    {
      displayName: "server",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/src/__tests__/lib/**/*.test.ts",
        "<rootDir>/src/__tests__/api/**/*.test.ts",
      ],
      transform: {
        "^.+\\.(t|j)sx?$": [
          "ts-jest",
          { tsconfig: { module: "commonjs", strict: true } },
        ],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
    // ── Browser tests (React components) ─────────────────────────────────
    {
      displayName: "browser",
      testEnvironment: "jest-environment-jsdom",
      testMatch: ["<rootDir>/src/__tests__/components/**/*.test.tsx"],
      transform: {
        "^.+\\.(t|j)sx?$": [
          "ts-jest",
          { tsconfig: { jsx: "react-jsx", module: "commonjs", strict: true } },
        ],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^react-force-graph-2d$":
          "<rootDir>/src/__tests__/__mocks__/react-force-graph-2d.tsx",
        "^next/dynamic$": "<rootDir>/src/__tests__/__mocks__/next-dynamic.tsx",
        "^next/navigation$":
          "<rootDir>/src/__tests__/__mocks__/next-navigation.ts",
      },
      // Runs AFTER jest-environment-jsdom is set up — loads jest-dom matchers
      setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
    },
  ],

  collectCoverageFrom: [
    "src/lib/**/*.ts",
    "src/app/api/**/*.ts",
    "src/components/**/*.tsx",
    "!src/**/*.d.ts",
    "!src/__tests__/**",
  ],
  coverageThreshold: {
    global: { branches: 60, functions: 65, lines: 65, statements: 65 },
  },
};

export default createJestConfig(config);
