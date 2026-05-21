/** Jest: hook integration specs in src/**\/__tests__ (useTourWizardServerSync.spec.ts). */
/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  rootDir: ".",
  testMatch: ["<rootDir>/src/**/__tests__/**/*.integration.test.tsx"],
  moduleNameMapper: {
    "^@/lib/(.*)$": "<rootDir>/lib/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
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
