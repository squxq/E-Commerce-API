module.exports = {
  rules: {
    indent: [
      2,
      2,
      {
        SwitchCase: 1,
      },
    ],
    "no-multi-spaces": 2,
    "no-trailing-spaces": 2,
    "space-before-blocks": 2,
  },
  overrides: [
    {
      files: ["**/*.ts"],
      parser: "@typescript-eslint/parser",
      plugins: ["@typescript-eslint"],
      extends: ["plugin:@typescript-eslint/eslint-recommended", "plugin:@typescript-eslint/recommended"],
    },
  ],
};
