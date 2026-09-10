import { expect } from "chai";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdirSync,
} from "fs";
import { join, delimiter } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { execute } from "../src/main.js";

describe("Version bump CLI integration", () => {
  let root, packageDir, oldPath, oldVersions, oldCli;
  before(() => {
    root = mkdtempSync(join(tmpdir(), "version bump "));
    const bin = join(root, "bin");
    mkdirSync(bin);
    const npm = execFileSync("which", ["npm"], { encoding: "utf8" }).trim();
    oldCli = process.env.TEST_REAL_NPM;
    process.env.TEST_REAL_NPM = npm;
    writeFileSync(
      join(bin, "npm"),
      `#!/usr/bin/env node
const { execFileSync } = require("child_process")
if (process.argv[2] === "view") {
  process.stdout.write(process.env.TEST_NPM_VERSIONS || "")
} else {
  process.stdout.write(execFileSync(process.env.TEST_REAL_NPM, process.argv.slice(2), { cwd: process.cwd() }))
}
`,
      { mode: 0o755 }
    );
    oldPath = process.env.PATH;
    oldVersions = process.env.TEST_NPM_VERSIONS;
    process.env.PATH = bin + delimiter + oldPath;
  });
  after(() => {
    process.env.PATH = oldPath;
    for (const [key, value] of [
      ["TEST_NPM_VERSIONS", oldVersions],
      ["TEST_REAL_NPM", oldCli],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(root, { recursive: true, force: true });
  });
  beforeEach(() => {
    packageDir = mkdtempSync(join(root, "project with spaces "));
    writeFileSync(
      join(packageDir, "package.json"),
      JSON.stringify({
        name: "@threshold-network/test",
        version: "1.2.0-dev.1",
      })
    );
  });
  it("selects the latest matching prerelease and preserves branch/commit metadata", async () => {
    process.env.TEST_NPM_VERSIONS = JSON.stringify([
      "1.2.0-dev.2",
      "1.2.0-dev.4",
      "1.2.0-rc.9",
    ]);
    const result = await execute(
      packageDir,
      true,
      "dev",
      "refs/heads/feature/test.2",
      "abc123"
    );
    expect(result).to.equal("1.2.0-dev.5+feature-test-2.abc123");
    expect(
      JSON.parse(readFileSync(join(packageDir, "package.json"))).version
    ).to.equal(result);
  });
  it("uses the manifest version when the registry returns no matching versions", async () => {
    process.env.TEST_NPM_VERSIONS = "";
    expect(await execute(packageDir, true, "dev")).to.equal("1.2.0-dev.2");
  });
  it("supports a single registry version", async () => {
    process.env.TEST_NPM_VERSIONS = JSON.stringify("1.2.0-dev.8");
    expect(await execute(packageDir, true, "dev", "main", "abc123")).to.equal(
      "1.2.0-dev.9+main.abc123"
    );
  });
});
