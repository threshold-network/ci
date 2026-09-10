# Threshold CI migration

Use immutable commit SHAs for all action and reusable-workflow references.
`npm-version-bump` is now `threshold-network/ci/actions/npm-version-bump@<sha>`;
the other action paths stay the same under `threshold-network/ci`.
The documentation workflow is
`threshold-network/ci/.github/workflows/reusable-solidity-docs.yml@<sha>`.

## Consumer updates

Switch both action references and module identifiers in keep-core, tbtc-v2, and
solidity-contracts. A completion module such as
`github.com/keep-network/keep-core/ecdsa` becomes
`github.com/threshold-network/keep-core/ecdsa`; upstream-build queries must use
that same identifier. These identifiers are CI payload keys, independent of Go
module paths or npm package names. Start a new pipeline after migration instead
of resuming one with old payload keys.

The configured pipeline is Solidity contracts → Random Beacon → ECDSA → tBTC →
keep-core client. Random Beacon remains a build input in the current source tree;
its presence here makes no assertion about live protocol use. Removed destinations:
coverage-pools (no current direct consumer), archived token-dashboard, and the
Arbitrum workflow (which no longer accepts workflow_dispatch). The regular
Arbitrum pull-request, push, and scheduled tests remain in tbtc-v2.

The environment action loads the configuration bundled at its pinned revision.
An explicit `ref` is still supported for a different Threshold configuration
revision. Existing cloud project values are preserved: changing GitHub ownership
does not itself migrate cloud infrastructure.

The docs workflow accepts a `nodeVersion` input (default 22.23.1). The legacy
solidity-contracts Hardhat 2.10 stack selects 18.20.8 until that project upgrades
its build dependencies; action execution still uses Node 24.

The docs workflow supports both Yarn Classic and modern Yarn lockfiles. Pin the
matching Yarn version with `packageManager`, `yarnPath`, or a shim installed by
`preProcessingCommand`. Node and Corepack setup runs before preprocessing so
consumer shims keep precedence for installation and docgen. The workflow rejects
a Yarn/lockfile format mismatch before installing dependencies, and enforces
`--frozen-lockfile` for Classic or `--immutable` for Berry. It uses artifact v4
and gh for authenticated pushes and PR creation. Existing
keep-core local docs workflows are already owned and need no source switch.
The docs destination rename is tracked separately by keep-core #4321 and
tbtc-v2 #1135.

## Rollout

1. Review and merge the CI producer PR. Keep this repository's default
   branch as the release-manager source. Do not use inherited v2 tags: they refer
   to the unmodified Keep implementation.
2. Ensure `CI_GITHUB_TOKEN` is available to threshold-network/ci and each consumer.
   It must be able to dispatch actions in these four repositories. Reuse the
   organization's selected-repository secret if available; do not expose tokens
   in workflow files. Ordinary fork and PR tests need no token.
3. Merge all consumer PRs before starting the inter-repository release manager.
   They pin the reviewed producer commit, not a moving branch. Existing npm,
   deployment, docs, and cloud secrets remain configured in the consumer repos.
4. Start a deliberately requested release only after those changes are in place.
   Validation of this migration does not publish npm packages, push docs, deploy
   contracts, or invoke the release pipeline.

## Review links

- CI producer: https://github.com/threshold-network/ci/pull/1
- keep-core consumer: https://github.com/threshold-network/keep-core/pull/4329
- tbtc-v2 consumer: https://github.com/threshold-network/tbtc-v2/pull/1148
- solidity-contracts consumer: https://github.com/threshold-network/solidity-contracts/pull/195

The consumers currently pin `20b35345d276a3c7365e3829b8078387a7c9dccb`, which
includes the Node compatibility and schema-validation fixes. Before merging the
consumer PRs, update their pins to the reviewed producer revision that also
preserves consumer Yarn shims and enforces the lockfile format.
