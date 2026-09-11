# Run GitHub Actions Workflow Action

This is a GitHub Action that runs an external workflow.

## Action Inputs

The action supports following input parameters:

- `environment` (optional, default: `dev`)

- `upstream_builds` (optional)

- `upstream_ref` (optional, default: `main`)

## Action Usage

```yaml
- uses: threshold-network/ci/actions/run-workflow@<reviewed-commit-sha>
  with:
    environment: test
    upstream_builds: {}
    upstream_ref: main
```

## External Workflow Configuration

It is required that the destination workflow the action is going to call handles
the following input parameters:

- `environment`

- `upstream_builds`

- `upstream_ref`

Workflow configuration sample:

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment for workflow execution'
        required: false
        default: 'dev'
      upstream_builds:
        description: 'Upstream builds'
        required: false
      upstream_ref:
        description: 'Git reference to checkout (e.g. branch name)'
        required: false
        default: 'main'
```

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
