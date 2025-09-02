// Basic ESLint config for a modern JS project
export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        document: true,
        window: true,
        fetch: true,
        setTimeout: true,
        console: true
      }
    },
    rules: {
      semi: ["error", "always"],
      quotes: ["error", "double"],
      "no-unused-vars": "warn",
      "no-undef": "error",
      "no-console": "off"
    },
  },
];
