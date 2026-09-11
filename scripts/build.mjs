import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
const actions = [
  "notify-workflow-completed",
  "run-workflow",
  "upstream-builds-query",
  "npm-version-bump",
];
for (const action of actions) {
  const dir = `actions/${action}`;
  rmSync(`${dir}/dist`, { recursive: true, force: true });
  execFileSync(
    process.execPath,
    [
      "node_modules/@vercel/ncc/dist/ncc/cli.js",
      "build",
      `${dir}/index.js`,
      "-o",
      `${dir}/dist`,
      "--license",
      "licenses.txt",
    ],
    { stdio: "inherit" }
  );
  // Preserve the module format selected by ncc.
  writeFileSync(
    `${dir}/dist/package.json`,
    JSON.stringify({ type: "module" }) + "\n"
  );
}
