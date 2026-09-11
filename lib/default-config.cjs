// CJS shim so ncc statically inlines config/config.json into each action bundle; npm run check:bundles guards this — do not convert to an ESM JSON import.
module.exports = require("../config/config.json");
