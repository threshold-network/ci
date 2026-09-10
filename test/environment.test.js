import { expect } from "chai";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

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
});
