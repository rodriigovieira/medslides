import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Flutter app. Its build directory contains vendored JS assets from
    // pub packages (wakelock_plus ships a no_sleep.js), which this config
    // happily linted and failed on — the same mistake that made the Vercel
    // deploy try to upload 1.1 GB of iOS artefacts. The web toolchain has no
    // business below apps/.
    "apps/**",
  ]),
]);

export default eslintConfig;
