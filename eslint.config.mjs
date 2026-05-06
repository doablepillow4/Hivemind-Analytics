import js from "@eslint/js";
import ts from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

// Note: eslint-plugin-react excluded — v7.x has a known incompatibility
// with ESLint v10's flat config API (getFilename removed). TypeScript already
// enforces JSX correctness; react-hooks covers hooks rules.

export default ts.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      ".agents/**",
      ".local/**",
      "lib/api-client-react/src/generated/**",
      "lib/api-zod/src/generated/**",
    ],
  },

  js.configs.recommended,

  ...ts.configs.recommended,

  // React Hooks rules for frontend
  {
    files: ["artifacts/hivemind/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Core hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // New v5 rules: disabled — these flag valid patterns in shadcn/ui components
      // (e.g. initialization setState in effects, Math.random in useMemo)
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },

  // Node.js backend + libs (including build scripts)
  {
    files: ["artifacts/api-server/**/*.{ts,mjs}", "lib/**/*.ts", "scripts/**/*.ts", "*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },

  // Shared overrides
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-require-imports": "warn",
      "eqeqeq": ["error", "always"],
      // Allow empty catch blocks (intentional swallow-and-continue patterns are documented inline)
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Disabled: produces too many false positives for the exhaustive if/else + let pattern
      "no-useless-assignment": "off",
    },
  },
);
