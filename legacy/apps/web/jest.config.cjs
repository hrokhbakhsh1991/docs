/** Jest: hook integration specs in src/**\/__tests__ (useTourWizardServerSync.spec.ts). */
/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  rootDir: ".",
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  testPathIgnorePatterns: ["<rootDir>/.next/"],
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.integration.test.tsx",
    "<rootDir>/src/**/*.integration.test.tsx",
    "<rootDir>/src/**/__tests__/guards/**/*.perf.spec.tsx",
  ],
  moduleNameMapper: {
    "^@test-utils/(.*)$": "<rootDir>/tests/utils/$1",
    "^@test-utils$": "<rootDir>/tests/utils/index.ts",
    "^@/app/(.*)$": "<rootDir>/app/$1",
    "^@/lib/(.*)$": "<rootDir>/lib/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "<rootDir>/jest.styleMock.cjs",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          module: "commonjs",
          esModuleInterop: true,
          baseUrl: ".",
          paths: {
            "@/*": ["./src/*"],
            "@/lib/*": ["./lib/*"],
          },
        },
      },
    ],
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};
