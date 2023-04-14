module.exports = {
  testEnvironment: "node",
  testEnvironmentOptions: {
    NODE_ENV: "test",
  },
  restoreMocks: true,
  coveragePathIgnorePatterns: ["node_modules", "src/config", "src/app.js", "tests", "dist/config", "dist/app.js"],
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
