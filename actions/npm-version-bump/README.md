# NPM Package Version Bump Action

CI runs in [threshold-network/ci](https://github.com/threshold-network/ci) via `test.yml`.

This is a GitHub Action that bumps version of a NPM Package.

The version is formatted according to the pattern described in the [RFC-18]:

```
<base-version>-<environment>.<build-number>+<branch>.<commit>
```

[RFC-18]:https://github.com/keep-network/keep-core/blob/master/docs/rfc/rfc-18-release-management.adoc#221-build-taggingpublishing

## Inputs

The action supports following input parameters:

- `work-dir` (optional, default: `.`) - location of `package.json` file,

- `is-prerelease` (optional, default: `true`) - defines if the version is a prerelease;
  pass the literal string `"false"` together with `environment: mainnet` to bump a
  release version instead,

- `environment` (optional) - prerelease id; when omitted and `is-prerelease` is
  truthy, the preid is inherited from the current version in `package.json`
  (falling back to `pre` if the current version isn't a prerelease).

- `branch` (optional) - branch reference at which version is built

- `commit` (optional) - commit hash at which version is built

### Branch conversion

It's expected that `branch` parameter will be populated with [GitHub context `ref`
property](https://docs.github.com/en/actions/reference/context-and-expression-syntax-for-github-actions#github-context):

> The branch or tag ref that triggered the workflow run. For branches this in the format refs/heads/<branch_name>, and for tags it is refs/tags/<tag_name>.

To handle this value correctly in the resulting version format the provided
value is converted in the following way:

- `refs/heads/` and `refs/tags/` prefixes are stripped out,

- any `/` occurrence is replaced by `-`,

- any `.` occurrence is replaced with `-`.

## Usage

<!-- prettier-ignore-start -->
```yaml
- uses: threshold-network/ci/actions/npm-version-bump@<reviewed-commit-sha>
  with:
    work-dir: ./contracts       # optional, default: .
    environment: "ropsten"      # optional, inherited from package.json when omitted
    branch: ${{ github.ref }}   # optional
    commit: ${{ github.sha }}   # optional
```
<!-- prettier-ignore-end -->

## Outputs

The action outputs `version` property with a value of the resolved package version.

Example usage:

```yaml
- uses: threshold-network/ci/actions/npm-version-bump@<reviewed-commit-sha>
  id: bump-version
- name: Print resolved version
  run: echo "Resolved new version ${{ steps.bump-version.outputs.version }}"
```
