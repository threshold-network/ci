import * as core from "@actions/core";
import { invoke } from "./src/invoke.js";

async function run() {
  try {
    const environment = core.getInput("environment");
    const upstreamBuilds = core.getInput("upstream_builds");
    const upstreamRef = core.getInput("upstream_ref");

    await invoke(environment, upstreamBuilds, upstreamRef);

    core.info(
      `dispatched run for environment: ${environment} with upstream builds: ${upstreamBuilds} and ref: ${upstreamRef}`
    );
  } catch (error) {
    core.setFailed(error);
  }
}

run();
