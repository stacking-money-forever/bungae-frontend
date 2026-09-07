import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "test-results/**",
      "playwright-report/**",
      // Playwright fixtures reuse the name `use` (fixture injection), which
      // the Next React-hooks rule would misread as a React Hook call.
      "e2e/**",
    ],
  },
];

export default eslintConfig;
