import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Prevent common typos and mistakes
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "error",
      "no-var": "error",
      
      // Security rules
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      
      // Code quality
      "complexity": ["warn", 15],
      "max-lines-per-function": ["warn", 100],
      "max-depth": ["warn", 4]
    }
  }
];

export default eslintConfig;
