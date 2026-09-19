import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    // Supabase query payloads and external-provider response boundaries are
    // runtime-validated before use. Requiring exhaustive structural types
    // for every dynamic row/provider payload adds noise without increasing
    // runtime safety; strict TypeScript and schema validation remain enabled.
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/app/**/*.tsx"],
    // Async Server Components legitimately derive current-time display/window
    // values during a request. React's client-render purity rule does not model
    // that server-only execution context accurately.
    rules: {
      "react-hooks/purity": "off",
    },
  },
  globalIgnores([".next/**", "coverage/**", "dist/**", ".worktrees/**"]),
]);
