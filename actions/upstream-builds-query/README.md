# Upstream Builds Query Action

[![build](https://github.com/keep-network/upstream-builds-query/actions/workflows/build.yml/badge.svg)](https://github.com/keep-network/upstream-builds-query/actions/workflows/build.yml)
[![test](https://github.com/keep-network/upstream-builds-query/actions/workflows/test.yml/badge.svg)](https://github.com/keep-network/upstream-builds-query/actions/workflows/test.yml)

<!-- TODO: Write documentation -->
## Usage

<!-- prettier-ignore-start -->
```yaml
- uses: threshold-network/ci/actions/upstream-builds-query@<reviewed-commit-sha>
  id: upstream-builds-query
  with:
    upstream-builds: ${{ github.event.inputs.upstream_builds }}
    fail-on-empty: false # default: true
    query: |
        solidity-contracts-version = github.com/threshold-network/solidity-contracts#version
        tbtc-contracts-version = github.com/threshold-network/tbtc-v2#version
```
<!-- prettier-ignore-end -->

## Outputs

The action emits one dynamically named output per query (`<output> =
<module>#<property>`), each containing the selected property (`version`,
`url`, or `upstream_ref`) of the most recent build matching that module.

Example usage:

```yaml
- uses: threshold-network/ci/actions/upstream-builds-query@<reviewed-commit-sha>
  id: upstream-builds-query
  with:
    upstream-builds: ${{ github.event.inputs.upstream_builds }}
    query: |
        solidity-contracts-version = github.com/threshold-network/solidity-contracts#version
        tbtc-contracts-version = github.com/threshold-network/tbtc-v2#version
- name: Print resolved version
  run: |
    echo "Resolved version: ${{ steps.upstream-builds-query.outputs.solidity-contracts-version }}"
    echo "Resolved version: ${{ steps.upstream-builds-query.outputs.tbtc-contracts-version }}"
```
