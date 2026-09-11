# Upstream provenance

This repository is a fork of keep-network/ci. The Threshold maintenance baseline
is f116ada99b2d7d736089ed21f2fd55d3c1030272.

`actions/npm-version-bump` is vendored from keep-network/npm-version-bump at
ab775eb34329172754544d5fd5cd37ff13be64ce (the upstream v2 branch). Its MIT license
is retained in that directory. No separate npm-version-bump fork is needed.

### npm-version-bump divergence

The vendored copy diverges from the upstream commit above: it was rewritten
for this repository rather than carried over verbatim. Notable differences:

- Converted from CommonJS to ESM (`type: module`, `import`/`export`).
- `runs: node24` in `action.yml` instead of the upstream `node16`/`node20`.
- Command execution uses `execFile` with an argv array and explicit `cwd`
  instead of building a shell command string.
- The package is renamed `@threshold-network/npm-version` with bumped
  dependency versions.

### Re-vendoring

To pull a newer upstream revision:

1. Note the target commit in keep-network/npm-version-bump and diff it
   against `ab775eb34329172754544d5fd5cd37ff13be64ce` to see what changed
   upstream.
2. Apply the equivalent changes on top of the vendored, already-diverged
   copy in `actions/npm-version-bump` (do not overwrite it wholesale — the
   ESM conversion, `execFile` argv usage, and renamed package must be
   preserved).
3. Rebuild with `npm run build` to regenerate `dist/index.js` and
   `dist/licenses.txt`.
4. Verify with `npm run check:bundles` and `npm test`.
5. Commit the updated source, `dist`, and this file's recorded upstream
   commit together.

Original source and dependency license notices are preserved. Bundled dependency
notices are regenerated in each action's `dist/licenses.txt` by `npm run build`.
