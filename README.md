# Threshold CI

Maintained GitHub Actions and a reusable Solidity documentation workflow for
Threshold repositories. This fork includes the vendored npm-version-bump action;
see [UPSTREAM.md](UPSTREAM.md) for provenance and retained licenses.

| Action | Purpose |
| --- | --- |
| `actions/load-env-variables` | Load public environment configuration from the pinned revision |
| `actions/upstream-builds-query` | Extract versions and URLs from completed build payloads |
| `actions/notify-workflow-completed` | Notify the Threshold release manager of a completed build |
| `actions/run-workflow` | Dispatch the next configured Threshold workflow |
| `actions/npm-version-bump` | Compute and write a package prerelease version |

Consumers pin actions and `.github/workflows/reusable-solidity-docs.yml` to a
reviewed full commit SHA. Each action directory documents its inputs.
[MIGRATION.md](MIGRATION.md) describes coordinated consumer changes, credentials,
and rollout order. Do not use the inherited v2 tags for the maintained actions.

## Development

Use Node 24 and run:

```sh
npm ci
npm run lint
npm test
npm run build
npm run check:bundles
```

Commit regenerated `dist` files with source changes. Tests include local/mock
registry and dispatch checks; they do not publish packages or invoke release
workflows. `check:bundles` runs the shipped bundles outside the source tree with
no `node_modules` directory. This repository is not published to npm.

The release manager is manually dispatched via `main.yml`. Its source and
configuration come from the default branch; `upstream_ref` selects
consumer branches. It requires `CI_GITHUB_TOKEN` with Actions write permission
on this repository and the three configured consumer repositories. Public
configuration in `config/env` contains no credentials; use GitHub secrets for
credentials.
