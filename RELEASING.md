# Releasing

Releases are created by the manual **Release** GitHub Actions workflow.

1. Update the version in `package.json` and `package-lock.json`:

   ```bash
   npm version 2.0.1 --no-git-tag-version
   ```

2. Install dependencies and verify the action:

   ```bash
   npm ci
   npm run verify
   ```

3. Commit the version change in a pull request and merge it into `main`.

4. Open **Actions → Release → Run workflow**, select `main`, and enter the
   version without a leading `v`, such as `2.0.1`.

The workflow verifies that the requested version matches `package.json`, runs
the full test and build checks, creates the immutable version tag and GitHub
Release, and advances the matching major-version tag. For example, releasing
`2.0.1` creates `v2.0.1` and moves `v2` to the same commit.

The workflow can safely be retried for the same version and commit. It fails if
the requested version tag already points to another commit.
