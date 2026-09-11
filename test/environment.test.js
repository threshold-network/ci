import { expect } from "chai";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

// Mock curl shim mirroring curl.sh's redirection shape: it locates the
// `--output <file>` argument pair and writes to that file, exactly as the
// real curl would when passed `--output "$3"`.
const curlShimBody = `#!/usr/bin/env bash
set -euo pipefail
output_file=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      output_file="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
printf 'REMOTE_VAR=remote-value\\n' > "$output_file"
`;

const failingCurlShimBody = `#!/usr/bin/env bash
exit 7
`;

describe("Environment configuration", () => {
  let root, output;
  const action = resolve("actions/load-env-variables");
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "action env "));
    output = join(root, "github env");
    writeFileSync(output, "");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  it("loads the pinned local configuration without GitHub API access", () => {
    execFileSync("bash", [join(action, "load.sh")], {
      env: {
        ...process.env,
        GITHUB_ENV: output,
        ACTION_PATH: action,
        CONFIG_ENVIRONMENT: "sepolia",
        CONFIG_REF: "",
      },
    });
    expect(readFileSync(output, "utf8")).to.include("NETWORK_ID=11155111\n");
  });
  it("rejects missing environments and path traversal", () => {
    for (const environment of ["missing", "../../package"]) {
      expect(() =>
        execFileSync("bash", [join(action, "load.sh")], {
          stdio: "pipe",
          env: {
            ...process.env,
            GITHUB_ENV: output,
            ACTION_PATH: action,
            CONFIG_ENVIRONMENT: environment,
            CONFIG_REF: "",
          },
        })
      ).to.throw();
      expect(readFileSync(output, "utf8")).to.equal("");
    }
  });
  it("validates the entire file before exporting any values", () => {
    const file = join(root, "bad.env");
    writeFileSync(file, "GOOD=value\ninvalid line\n");
    expect(() =>
      execFileSync("bash", [join(action, "env-import.sh"), "-f", file], {
        stdio: "pipe",
        env: { ...process.env, GITHUB_ENV: output },
      })
    ).to.throw();
    expect(readFileSync(output, "utf8")).to.equal("");
  });
  it("fetches remote configuration via curl when CONFIG_REF is set", () => {
    const curlBin = join(root, "bin");
    mkdirSync(curlBin, { recursive: true });
    writeFileSync(join(curlBin, "curl"), curlShimBody, { mode: 0o755 });
    execFileSync("bash", [join(action, "load.sh")], {
      env: {
        ...process.env,
        PATH: `${curlBin}:${process.env.PATH}`,
        GITHUB_ENV: output,
        ACTION_PATH: action,
        CONFIG_ENVIRONMENT: "sepolia",
        CONFIG_REF: "some-ref",
      },
    });
    expect(readFileSync(output, "utf8")).to.include(
      "REMOTE_VAR=remote-value\n"
    );
  });
  it("propagates curl failures without writing to GITHUB_ENV", () => {
    const curlBin = join(root, "bin-fail");
    mkdirSync(curlBin, { recursive: true });
    writeFileSync(join(curlBin, "curl"), failingCurlShimBody, {
      mode: 0o755,
    });
    expect(() =>
      execFileSync("bash", [join(action, "load.sh")], {
        stdio: "pipe",
        env: {
          ...process.env,
          PATH: `${curlBin}:${process.env.PATH}`,
          GITHUB_ENV: output,
          ACTION_PATH: action,
          CONFIG_ENVIRONMENT: "sepolia",
          CONFIG_REF: "some-ref",
        },
      })
    ).to.throw();
    expect(readFileSync(output, "utf8")).to.equal("");
  });
});
