# Deployment branch model

Status: proposed implementation on `ci/deployment-branch-model`.

## Permanent mapping

| Branch      | Environment                     | Automation                                     | Promotion rule                                               |
| ----------- | ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `dev`       | staging                         | `.github/workflows/deploy-staging.yml` on push | protected `staging` environment approval                     |
| `main`      | production                      | `.github/workflows/deploy-vps.yml` on push     | reviewed PR plus protected `production` environment approval |
| `release/*` | temporary release/certification | no automatic deployment                        | reviewed PR into `dev`; later reviewed PR into `main`        |

`workflow_dispatch` is allowed only as an explicitly guarded operation: the staging workflow accepts `dev`, and the production workflow accepts `main`. A manually selected ref cannot change the target path.

## Wallet migration path

The current release branch is based on an older main ancestor. Before creating `dev`, verify the merge-base and review the commits unique to each side. Create `dev` from the current `origin/main`, then merge `release/denali-wallet-v1` through a normal reviewed PR. Staging certification happens on `dev`; only after it passes does a second reviewed PR promote `dev` to `main`. No force-push, reset, direct release-to-main merge, or production workflow run is part of this plan.

The generic workflows build the repository artifact on GitHub-hosted runners and verify both `releaseSha == github.sha` and the independent tarball SHA-256 digest. Deployment uses only the existing staging/production adapters and their fixed paths. Workspace-specific checks, including a Wallet pilot-only check, are supplied by a repository-local staging adapter configured in the protected `staging` environment; generic CI does not name Denali tenants or seed behavior.

## Required GitHub configuration

Create protected GitHub Environments named `staging` and `production`, each with required reviewers. Configure only the environment that is being used:

- `staging` secrets: `VPS_HOST`, `VPS_SSH_KEY`; variables: `VPS_USER`, `STAGING_ADAPTER_PATH`.
- `production` secrets: `VPS_HOST`, `VPS_SSH_KEY`; variables: `VPS_USER`, `VPS_DEPLOY_PATH` if needed by the existing production script.

The VPS-side environment files remain authoritative for database credentials. They are never emitted into workflow logs. The staging adapter must reject production targets, non-staging paths, bulk tenant activation, and any release/digest mismatch; a Wallet adapter must enforce the existing pilot-only guard.

## Risks and gates

- `origin/dev` does not exist yet; branch creation requires the ancestry check and repository policy approval.
- The release branch contains Wallet commits absent from current `main`; the PR must be reviewed for conflicts and scope.
- GitHub Environment protection and secrets are external configuration and are not changed by this repository commit.
- No workflow is run by this change. Deployment remains blocked until `dev` exists, protection is configured, and the adapter is present and executable.
