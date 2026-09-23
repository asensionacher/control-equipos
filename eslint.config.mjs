import { defineConfig, globalIgnores } from "eslint/config";
import { fixupConfigRules } from "@eslint/compat";
import nextVitals from "eslint-config-next/core-web-vitals";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([
  ...fixupConfigRules(nextVitals),
  {
    files: ["**/*.{js,mjs,cjs,mts,cts}"],
    languageOptions: {
      parser: tsParser,
    },
  },
  globalIgnores([
    ".next/**",
    "coverage/**",
    "node_modules/**",
    "next-env.d.ts",
  ]),
]);
