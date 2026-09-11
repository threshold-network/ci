/** @type {import ("@threshold-network/ci/lib/upstream-builds.js" UpstreamBuilds) UpstreamBuilds }*/

import * as core from "@actions/core";
import { dispatch } from "@threshold-network/ci";

/**
 * Notifies the release manager repository about build completion.
 * @param {string} module
 * @param {string} url
 * @param {string} environment
 * @param {string} previousUpstreamBuilds
 * @param {string} upstreamRef
 * @param {string} version
 * @return {string} Upstream builds
 */
async function notifyReleaseManager(
  module,
  url,
  environment,
  previousUpstreamBuilds,
  upstreamRef,
  version
) {
  core.info("appending current build info to upstream builds array");

  const parsed = JSON.parse(previousUpstreamBuilds);
  if (!Array.isArray(parsed)) {
    throw new Error("invalid upstream_builds: expected an array");
  }

  /** @type {UpstreamBuilds} */
  const newUpstreamBuilds = Array.from(parsed);
  newUpstreamBuilds.push({
    module: module,
    upstream_ref: upstreamRef,
    version: version,
    url: url,
  });

  const newUpstreamBuildsString = JSON.stringify(newUpstreamBuilds);

  core.debug(`upstream builds: ${newUpstreamBuildsString}`);

  await dispatch(
    "threshold-network",
    "ci",
    "main.yml",
    "main",
    upstreamRef,
    environment,
    newUpstreamBuildsString
  );

  return newUpstreamBuildsString;
}

export { notifyReleaseManager };
