import { Validator } from "jsonschema";

/**
 * @typedef {Build[]} UpstreamBuilds
 * @typedef {Object} Build
 * @property {string} module The name of the module that was built, including the
 * repository (e.g. github.com/keep-network/keep-core/solidity)
 * @property {string} upstream_ref The ref used for this build
 * @property {string} version The module version used for this build
 * @property {string} url A URL that points to the GitHub Action run in-browser
 */

// Inline the item schema: recent Node versions reject the empty base URL used
// by jsonschema for fragment-only $ref resolution.
const upstreamBuildsJsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      module: { type: "string" },
      upstream_ref: { type: "string" },
      version: { type: "string" },
      url: { type: "string" },
    },
    required: ["module", "version"],
  },
};

export function validateUpstreamBuilds(upstreamBuildsString) {
  const v = new Validator();
  const result = v.validate(
    JSON.parse(upstreamBuildsString),
    upstreamBuildsJsonSchema
  );

  if (result.errors && result.errors.length > 0) {
    return { isValid: false, errors: result.errors };
  } else {
    return { isValid: true };
  }
}
