import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

// Simulate GitHub's downloaded action: no source package or node_modules present.
const root = mkdtempSync(join(tmpdir(), "threshold-actions-"));
try {
  for (const name of [
    "run-workflow",
    "notify-workflow-completed",
    "upstream-builds-query",
    "npm-version-bump",
  ]) {
    cpSync(`actions/${name}/dist`, join(root, name), { recursive: true });
  }
  const output = join(root, "output");
  writeFileSync(output, "");
  const module = "github.com/threshold-network/keep-core/client";
  const builds = JSON.stringify([{ module, version: "2.1.0-dev.1" }]);
  const env = { ...process.env, GITHUB_OUTPUT: output, GITHUB_WORKSPACE: root };
  execFileSync(
    process.execPath,
    [join(root, "upstream-builds-query/index.js")],
    {
      cwd: root,
      env: {
        ...env,
        "INPUT_UPSTREAM-BUILDS": builds,
        INPUT_QUERY: `version = ${module}#version`,
        "INPUT_FAIL-ON-EMPTY": "true",
      },
    }
  );
  assert.match(readFileSync(output, "utf8"), /2\.1\.0-dev\.1/);
  // A terminal module validates bundled config without making a dispatch.
  execFileSync(process.execPath, [join(root, "run-workflow/index.js")], {
    cwd: root,
    env: {
      ...env,
      INPUT_UPSTREAM_BUILDS: builds,
      INPUT_ENVIRONMENT: "sepolia",
      INPUT_UPSTREAM_REF: "main",
    },
  });
  // Notification loads correctly and fails locally before networking without a token.
  try {
    execFileSync(
      process.execPath,
      [join(root, "notify-workflow-completed/index.js")],
      {
        cwd: root,
        env: {
          ...env,
          GITHUB_TOKEN: "",
          INPUT_UPSTREAM_BUILDS: "[]",
          INPUT_MODULE: module,
          INPUT_VERSION: "2.1.0-dev.1",
        },
        stdio: "pipe",
      }
    );
    assert.fail("Notification should require a token");
  } catch (error) {
    assert.match(String(error.stdout), /GITHUB_TOKEN not defined/);
  }
  // A local fake registry response plus the real npm version command tests the shipped bundle.
  const bin = join(root, "bin");
  mkdirSync(bin);
  const realNpm = execFileSync("which", ["npm"], { encoding: "utf8" }).trim();
  writeFileSync(
    join(bin, "npm"),
    `#!/usr/bin/env node
const { execFileSync } = require("child_process")
if (process.argv[2] === "view") process.stdout.write(JSON.stringify(["1.2.0-dev.1", "1.2.0-dev.3"]))
else process.stdout.write(execFileSync(process.env.TEST_REAL_NPM, process.argv.slice(2), { cwd: process.cwd() }))
`,
    { mode: 0o755 }
  );
  const project = join(root, "consumer with spaces");
  mkdirSync(project);
  writeFileSync(
    join(project, "package.json"),
    JSON.stringify({ name: "@threshold-network/test", version: "1.2.0-dev.1" })
  );
  execFileSync(process.execPath, [resolve(root, "npm-version-bump/index.js")], {
    cwd: root,
    env: {
      ...env,
      PATH: `${bin}:${process.env.PATH}`,
      TEST_REAL_NPM: realNpm,
      "INPUT_WORK-DIR": project,
      "INPUT_IS-PRERELEASE": "true",
      INPUT_ENVIRONMENT: "dev",
      INPUT_BRANCH: "refs/heads/main",
      INPUT_COMMIT: "abc123",
    },
  });
  assert.equal(
    JSON.parse(readFileSync(join(project, "package.json"))).version,
    "1.2.0-dev.4+main.abc123"
  );
  console.log("All four standalone action bundles passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
