/** @typedef {import ("@threshold-network/ci/lib/upstream-builds.js").UpstreamBuilds } UpstreamBuilds */

import { validateUpstreamBuilds as ciValidateUpstreamBuilds } from "@threshold-network/ci";
import { parseQueriesArray } from "./query.js";

/**
 * @param {string} upstreamBuildsString
 * @param {string[]} queriesString
 * @param {bool} failOnEmpty
 * @return {*}
 */
export function execute(
  upstreamBuildsString,
  queriesString,
  failOnEmpty = true
) {
  try {
    validateUpstreamBuilds(upstreamBuildsString);
  } catch (err) {
    throw new Error(`upstream builds validation failed: ${err}`);
  }

  /** @type {UpstreamBuilds} */
  const upstreamBuilds = JSON.parse(upstreamBuildsString);

  // Reverse the array to get find the last element matching query.
  upstreamBuilds.reverse();

  const queries = parseQueriesArray(queriesString);

  const results = {};
  queries.forEach((query) => {
    const build = upstreamBuilds.find((build) => build.module == query.module);

    if (!build)
      throw new Error(`module [${query.module}] not found in upstream builds`);
    const result = build[query.property];
    if (result === undefined) {
      throw new Error(
        `property [${query.property}] not found for module [${query.module}]`
      );
    } else if (failOnEmpty && String(result).trim() === "") {
      throw new Error(
        `value is empty for module [${query.module}] and property [${query.property}]`
      );
    }

    results[query.output] = result;
  });

  return results;
}

function validateUpstreamBuilds(upstreamBuildsString) {
  const { isValid, errors } = ciValidateUpstreamBuilds(upstreamBuildsString);
  if (!isValid) {
    throw new Error(`invalid upstream builds: ${JSON.stringify(errors)}`);
  }
}
