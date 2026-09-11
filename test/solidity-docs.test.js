import { expect } from "chai";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { load } from "js-yaml";

const workflow = load(
  readFileSync(".github/workflows/reusable-solidity-docs.yml", "utf8")
);
const steps = workflow.jobs["docs-generate-html-and-publish"].steps;
const classicLockfile = "# yarn lockfile v1\n";
const berryLockfile = "__metadata:\n  version: 8\n  cacheKey: 10c0\n";

// These executables record which tool the workflow actually selects. Package
// downloads and docgen are outside this test's installation-boundary scope.
function yarnShim(version) {
  return String.raw`#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.DOCS_CALLS, JSON.stringify({ version: "${version}", args }) + "\n");
if (args[0] === "--version") console.log("${version}");
if (args[0] === "install") process.exit(Number(process.env.DOCS_INSTALL_EXIT || 0));
`;
}

describe("Solidity docs dependency installation", function () {
  this.timeout(10000);

  let root, project, calls, env;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "solidity docs "));
    project = join(root, "consumer", "solidity");
    const runnerBin = join(root, "runner-bin");
    const nodeBin = join(root, "node-bin");
    const consumerBin = join(root, "consumer-bin");
    for (const directory of [project, runnerBin, nodeBin, consumerBin]) {
      mkdirSync(directory, { recursive: true });
    }
    calls = join(root, "calls.jsonl");
    writeFileSync(calls, "");
    writeFileSync(join(root, "github-path"), "");
    writeFileSync(join(project, "package.json"), '{"private":true}\n');
    writeFileSync(join(runnerBin, "yarn"), yarnShim("1.22.22"), {
      mode: 0o755,
    });
    writeFileSync(join(consumerBin, "yarn"), yarnShim("4.12.0"), {
      mode: 0o755,
    });
    writeFileSync(
      join(runnerBin, "corepack"),
      '#!/bin/sh\ncp "$DOCS_CLASSIC_SHIM" "$DOCS_NODE_BIN/yarn"\n',
      { mode: 0o755 }
    );
    env = {
      ...process.env,
      PATH: `${runnerBin}:${dirname(process.execPath)}:${process.env.PATH}`,
      GITHUB_PATH: join(root, "github-path"),
      DOCS_CALLS: calls,
      DOCS_CLASSIC_SHIM: join(runnerBin, "yarn"),
      DOCS_NODE_BIN: nodeBin,
      DOCS_CONSUMER_BIN: consumerBin,
      DOCS_INSTALL_EXIT: "0",
    };
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function runWorkflow({ lockfile, consumerShim = false }) {
    if (lockfile !== undefined) {
      writeFileSync(join(project, "yarn.lock"), lockfile);
    }
    let result;
    for (const step of steps) {
      let command;
      if (step.uses?.startsWith("actions/setup-node@")) {
        // setup-node prepends its toolchain to PATH, just as GITHUB_PATH does.
        env.PATH = `${env.DOCS_NODE_BIN}:${env.PATH}`;
      } else if (step.run === "${{ inputs.preProcessingCommand }}") {
        if (consumerShim) {
          command = 'echo "$DOCS_CONSUMER_BIN" >> "$GITHUB_PATH"';
        }
      } else if (
        [
          "Enable Corepack",
          "Install dependencies",
          "Build Markdown docs",
        ].includes(step.name)
      ) {
        command = step.run;
      }
      if (!command) continue;
      result = spawnSync(
        "bash",
        ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", command],
        {
          cwd: project,
          env: { ...env, ...step.env },
          encoding: "utf8",
        }
      );
      if (result.status !== 0) break;
      for (const path of readFileSync(env.GITHUB_PATH, "utf8")
        .split("\n")
        .filter(Boolean)) {
        env.PATH = `${path}:${env.PATH}`;
      }
      writeFileSync(env.GITHUB_PATH, "");
    }
    const invocations = readFileSync(calls, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter(({ args }) => args[0] !== "--version");
    return { ...result, invocations };
  }

  it("preserves an unpinned consumer's Berry shim for install and docgen", () => {
    const result = runWorkflow({ lockfile: berryLockfile, consumerShim: true });
    expect(result.status, result.stderr).to.equal(0);
    expect(result.invocations).to.deep.equal([
      { version: "4.12.0", args: ["install", "--immutable"] },
      { version: "4.12.0", args: ["run", "hardhat", "docgen"] },
    ]);
  });

  it("enforces a Classic lockfile with Yarn Classic", () => {
    const result = runWorkflow({ lockfile: classicLockfile });
    expect(result.status, result.stderr).to.equal(0);
    expect(result.invocations).to.deep.equal([
      { version: "1.22.22", args: ["install", "--frozen-lockfile"] },
      { version: "1.22.22", args: ["run", "hardhat", "docgen"] },
    ]);
  });

  it("rejects Classic for a Berry lockfile before installation", () => {
    const result = runWorkflow({ lockfile: berryLockfile });
    expect(result.status).to.equal(1);
    expect(result.stdout).to.include(
      "A Berry lockfile requires Yarn 2 or newer"
    );
    expect(result.invocations).to.deep.equal([]);
  });

  it("rejects Berry for a Classic lockfile before installation", () => {
    const result = runWorkflow({
      lockfile: classicLockfile,
      consumerShim: true,
    });
    expect(result.status).to.equal(1);
    expect(result.stdout).to.include("A Yarn Classic lockfile requires Yarn 1");
    expect(result.invocations).to.deep.equal([]);
  });

  for (const lockfile of [undefined, "unrecognized lockfile\n"]) {
    it(`rejects a ${
      lockfile === undefined ? "missing" : "malformed"
    } lockfile before installation`, () => {
      const result = runWorkflow({ lockfile });
      expect(result.status).to.equal(1);
      expect(result.stdout).to.include("A recognized yarn.lock is required");
      expect(result.invocations).to.deep.equal([]);
    });
  }

  it("stops before docgen when the locked install fails", () => {
    env.DOCS_INSTALL_EXIT = "42";
    const result = runWorkflow({ lockfile: berryLockfile, consumerShim: true });
    expect(result.status).to.equal(42);
    expect(result.invocations).to.deep.equal([
      { version: "4.12.0", args: ["install", "--immutable"] },
    ]);
  });
});

describe("Sync generated docs and create PR", function () {
  this.timeout(10000);

  const publishStep = steps.find(
    (step) => step.name === "Sync generated docs and create PR"
  );

  // Rewrites the hardcoded `https://github.com/<repo>.git` clone URL to a
  // local "remote" repository so the step can be driven without network
  // access, then delegates every other invocation to the real git binary.
  function gitShim(realGitPath) {
    return String.raw`#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const args = process.argv.slice(2);
if (args[0] === "clone") {
  for (let i = 0; i < args.length; i++) {
    if (/^https:\/\/github\.com\/.*\.git$/.test(args[i])) {
      args[i] = process.env.DOCS_REMOTE_PATH;
    }
  }
}
const result = spawnSync("${realGitPath}", args, { stdio: "inherit" });
process.exit(result.status ?? 1);
`;
  }

  // Records every invocation and fakes just the three `gh` subcommands the
  // step uses: auth setup, PR lookup (count controlled by
  // DOCS_EXISTING_PRS), and PR creation.
  const ghShim = `#!/bin/sh
echo "$@" >> "$DOCS_GH_CALLS"
case "$1 $2" in
  "auth setup-git")
    exit 0
    ;;
  "pr list")
    echo "$DOCS_EXISTING_PRS"
    exit 0
    ;;
  "pr create")
    exit 0
    ;;
esac
exit 1
`;

  let realGit, root, project, remote, binDir, ghCalls, env;

  before(() => {
    realGit = spawnSync("bash", ["-c", "command -v git"], {
      encoding: "utf8",
    }).stdout.trim();
  });

  function remoteGit(args) {
    return spawnSync(realGit, args, {
      cwd: remote,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "seed",
        GIT_AUTHOR_EMAIL: "seed@example.com",
        GIT_COMMITTER_NAME: "seed",
        GIT_COMMITTER_EMAIL: "seed@example.com",
      },
    });
  }

  // Seeds the local repo standing in for the real GitHub destination repo.
  // Passing `docsContent` pre-populates the base branch with the same
  // generated-docs layout the step would produce, to exercise the no-change
  // path.
  function seedRemote(docsContent) {
    mkdirSync(remote, { recursive: true });
    remoteGit(["init", "--initial-branch=main"]);
    writeFileSync(join(remote, "README.md"), "seed\n");
    if (docsContent !== undefined) {
      mkdirSync(join(remote, "generated-docs"), { recursive: true });
      writeFileSync(join(remote, "generated-docs", "index.md"), docsContent);
    }
    remoteGit(["add", "-A"]);
    remoteGit(["commit", "-m", "seed"]);
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "solidity docs publish "));
    project = join(root, "project");
    remote = join(root, "destination-origin");
    binDir = join(root, "bin");
    mkdirSync(join(project, "generated-docs"), { recursive: true });
    mkdirSync(binDir, { recursive: true });

    ghCalls = join(root, "gh-calls.txt");
    writeFileSync(ghCalls, "");
    writeFileSync(join(binDir, "gh"), ghShim, { mode: 0o755 });
    writeFileSync(join(binDir, "git"), gitShim(realGit), { mode: 0o755 });

    env = {
      ...process.env,
      PATH: `${binDir}:${dirname(process.execPath)}:${process.env.PATH}`,
      GH_TOKEN: "test-token",
      DOCS_REPO: "example-org/example-docs",
      DOCS_FOLDER: ".",
      DOCS_BASE: "main",
      DOCS_EMAIL: "docs-bot@example.com",
      DOCS_USER: "docs-bot",
      DOCS_DELETE: "false",
      DOCS_SIGN: "false",
      SOURCE_RUN: "https://github.com/example-org/example-repo/actions/runs/1",
      DOCS_REMOTE_PATH: remote,
      DOCS_GH_CALLS: ghCalls,
      DOCS_EXISTING_PRS: "0",
    };
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function runStep() {
    return spawnSync(
      "bash",
      ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", publishStep.run],
      { cwd: project, env, encoding: "utf8" }
    );
  }

  function ghCallLines() {
    return readFileSync(ghCalls, "utf8").split("\n").filter(Boolean);
  }

  function headBranchExists() {
    return (
      remoteGit([
        "rev-parse",
        "--verify",
        "refs/heads/auto-update-solidity-api-docs",
      ]).status === 0
    );
  }

  it("pushes the update and creates a PR when none exists yet", () => {
    seedRemote();
    writeFileSync(join(project, "generated-docs", "index.md"), "# Docs v1\n");

    const result = runStep();

    expect(result.status, result.stderr).to.equal(0);
    const calls = ghCallLines();
    expect(calls.some((line) => line.startsWith("pr list"))).to.be.true;
    expect(calls.some((line) => line.startsWith("pr create"))).to.be.true;
    expect(headBranchExists()).to.be.true;
    expect(
      remoteGit([
        "show",
        "auto-update-solidity-api-docs:generated-docs/index.md",
      ]).stdout
    ).to.equal("# Docs v1\n");
  });

  it("pushes the update but skips creating a duplicate PR when one already exists", () => {
    seedRemote();
    writeFileSync(join(project, "generated-docs", "index.md"), "# Docs v1\n");
    env.DOCS_EXISTING_PRS = "1";

    const result = runStep();

    expect(result.status, result.stderr).to.equal(0);
    const calls = ghCallLines();
    expect(calls.some((line) => line.startsWith("pr list"))).to.be.true;
    expect(calls.some((line) => line.startsWith("pr create"))).to.be.false;
    expect(headBranchExists()).to.be.true;
  });

  it("skips pushing and creating a PR when the generated docs are unchanged", () => {
    seedRemote("# Docs v1\n");
    writeFileSync(join(project, "generated-docs", "index.md"), "# Docs v1\n");

    const result = runStep();

    expect(result.status, result.stderr).to.equal(0);
    expect(result.stdout).to.include("No documentation changes.");
    const calls = ghCallLines();
    expect(calls.some((line) => line.startsWith("pr list"))).to.be.false;
    expect(calls.some((line) => line.startsWith("pr create"))).to.be.false;
    expect(headBranchExists()).to.be.false;
  });
});
