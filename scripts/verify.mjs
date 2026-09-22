// The same offline verification path on Windows and CI. No deployment commands.
import { spawnSync } from "node:child_process";
const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  // Only a syntactically valid URL is needed to prerender the client provider.
  // Verification builds are not deployable application artifacts.
  NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210",
};
const steps = [
  ["Node tests", ["--test", "tests/*.test.mjs"]],
  ["Unit/backend tests", ["node_modules/vitest/vitest.mjs", "run"]],
  ["Lint", ["node_modules/eslint/bin/eslint.js", ".", "--max-warnings=0"]],
  ["Production build", ["node_modules/next/dist/bin/next", "build"]],
  ["TypeScript", ["node_modules/typescript/bin/tsc", "--noEmit", "--incremental", "false"]],
  ["Browser regressions", ["node_modules/@playwright/test/cli.js", "test"]],
];
for (const [name, args] of steps) {
  console.log(`\n${name}`);
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
