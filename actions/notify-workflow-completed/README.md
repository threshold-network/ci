# Notify Workflow Completed GitHub Action

This is a GitHub Action that notifies release management workflow about a workflow
completion.

## Action Inputs

- `module` (required)

- `url` (required)

- `environment` (optional, default: `dev`)

- `upstream_builds` (required)

- `upstream_ref` (optional, default: `main`)

- `version` (required)

## Action Usage

```yaml
- uses: threshold-network/ci/actions/notify-workflow-completed@<reviewed-commit-sha>
  with:
    module: github.com/threshold-network/solidity-contracts
    url: https://github.com/threshold-network/solidity-contracts/actions/runs/123456789
    environment: test
    upstream_builds: ""
    upstream_ref: main
    version: 1.2.3
```

## External Workflow Configuration

It is required that the destination workflow the action is going to call handles
the following input parameters:

- `environment`

- `upstream_builds`

- `upstream_ref`

## Development

Use Node 24 and run:

```sh
npm ci
npm run lint
npm test
npm run build
npm run check:bundles
```

Commit the regenerated `dist` directory with source changes.
