// Shared ESLint flat config for every workspace package.
// Package lint scripts run `eslint src` from their own directory; ESLint
// walks up from there and picks up this file.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.tsbuildinfo",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // The codebase uses a leading underscore for deliberately unused
      // bindings (placeholder parameters, ignored tuple entries).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Register the React / Next plugins so the eslint-disable directives
    // already present in the source resolve. Only the rules the codebase
    // was written against are enabled.
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["apps/web/**/*.ts", "apps/web/**/*.tsx"],
    rules: {
      "@next/next/no-img-element": "warn",
      "react/no-danger": "warn",
    },
  },
);
