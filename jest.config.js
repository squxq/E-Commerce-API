module.exports = {
  testEnvironment: "node",
  testEnvironmentOptions: {
    NODE_ENV: "test",
  },
  restoreMocks: true,
  coveragePathIgnorePatterns: [
    "node_modules",
    "src/inbound/config",
    "src/inbound/app.js",
    "tests",
    "dist/interface/config",
    "dist/interface/app.js",
  ],
  coverageReporters: ["text", "lcov", "clover", "html"],
  globals: {
    "ts-jest": {
      diagnostics: false,
    },
  },
  transform: {
    "\\.ts$": ["ts-jest"],
  },
};
