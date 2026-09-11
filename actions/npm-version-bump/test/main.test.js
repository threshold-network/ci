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
  if (process.env.TEST_NPM_VIEW_ERROR) {
    process.stderr.write(process.env.TEST_NPM_VIEW_ERROR)
    process.exit(1)
  }
  process.stdout.write(process.env.TEST_NPM_VERSIONS || "")
} else {
  if (process.env.TEST_NPM_VERSION_WARN) {
    process.stderr.write(process.env.TEST_NPM_VERSION_WARN)
  }
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
  afterEach(() => {
    delete process.env.TEST_NPM_VIEW_ERROR;
    delete process.env.TEST_NPM_VERSION_WARN;
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
  it('does not perform a prerelease bump when is-prerelease is the literal string "false"', async () => {
    process.env.TEST_NPM_VERSIONS = "";
    let error;
    try {
      await execute(packageDir, "false", "mainnet");
    } catch (err) {
      error = err;
    }
    expect(error).to.be.instanceOf(Error);
    expect(error.message).to.equal("only prerelease version bump is supported");
    expect(
      JSON.parse(readFileSync(join(packageDir, "package.json"))).version
    ).to.equal("1.2.0-dev.1");
  });
  it("inherits the preid from the current version when environment is omitted", async () => {
    writeFileSync(
      join(packageDir, "package.json"),
      JSON.stringify({
        name: "@keep-network/keep-core",
        version: "1.0.1-ropsten.16",
      })
    );
    process.env.TEST_NPM_VERSIONS = "";
    expect(await execute(packageDir, "true", "")).to.equal("1.0.1-ropsten.17");
  });
  it("falls back to the manifest version when npm view reports a 404", async () => {
    process.env.TEST_NPM_VIEW_ERROR =
      "npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/@threshold-network%2ftest";
    expect(await execute(packageDir, true, "dev")).to.equal("1.2.0-dev.2");
  });
  it("succeeds when npm version only writes warnings to stderr", async () => {
    process.env.TEST_NPM_VERSIONS = "";
    process.env.TEST_NPM_VERSION_WARN =
      "npm warn deprecated some-dependency@1.0.0: use newer version instead\n";
    expect(await execute(packageDir, true, "dev")).to.equal("1.2.0-dev.2");
  });
});
