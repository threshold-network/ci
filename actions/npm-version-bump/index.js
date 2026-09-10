import * as core from "@actions/core";
import { execute } from "./src/main.js";

async function run() {
  try {
    await execute(
      core.getInput("work-dir"),
      core.getInput("is-prerelease"),
      core.getInput("environment"),
      core.getInput("branch"),
      core.getInput("commit")
    );
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
