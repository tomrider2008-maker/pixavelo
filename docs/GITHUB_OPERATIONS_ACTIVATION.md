# GitHub Operations Activation

## Activation status

This repository is externally active at `https://github.com/tomrider2008-maker/pixavelo`. The repository is private,
`origin` tracks it, GitHub Actions and Dependabot are enabled, and a manual production-operations run has passed. The
production environment is only partially protected because GitHub Free does not provide branch or environment
protection for this private repository. No production deployment was performed.

State verified on 2026-08-25 UTC:

| Control                      | Status                                      | Verifiable evidence                                                                                                                      |
| ---------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Private GitHub remote        | Active                                      | `origin` is `https://github.com/tomrider2008-maker/pixavelo.git`; `main` is pushed.                                                      |
| Actions policy               | Active                                      | GitHub-owned actions only, full-SHA pinning required, default token read-only, PR approval disabled.                                     |
| Main CI                      | Passed                                      | Run `32879231269` passed quality plus Chromium, Firefox, WebKit and both mobile profiles.                                                |
| Manual production operations | Passed                                      | Run `32879256015` passed endpoint plus all five browser projects and retained six artifacts for 90 days.                                 |
| Failure escalation           | Exercised and recovered                     | Run `32878411383` opened issue `#2`; the successful recovery run was linked and the issue was closed.                                    |
| Hourly/daily schedules       | Installed, first scheduled evidence pending | Hourly is minute 17 UTC; daily browser coverage is 03:15 UTC. A manual run is not a schedule record.                                     |
| Dependabot                   | Active                                      | Vulnerability alerts and automated security fixes are enabled; weekly npm/action updates are configured.                                 |
| `production` environment     | Partial                                     | Created with deployment branch restricted to `main`; required reviewers and admin-bypass prevention are unavailable on the current plan. |
| Cloudflare secrets           | Partial                                     | `CLOUDFLARE_ACCOUNT_ID` is installed; `CLOUDFLARE_API_TOKEN` is not installed.                                                           |

## Repository controls

Actions is restricted to GitHub-owned actions and every workflow action reference is pinned to a full commit SHA.
Verified and unverified third-party actions are disabled. The default `GITHUB_TOKEN` permission is read-only and
workflows cannot approve pull requests. Release, rollback and production-operations workflows elevate only the
permissions declared by their jobs.

Dependabot checks npm and pinned GitHub Actions weekly on Monday. TypeScript major versions `>=6.0.0` are temporarily
ignored because the current `typescript-eslint` peer range is `<6.1.0`; this prevents Dependabot from proposing an
uninstallable TypeScript 7 dependency set. Revisit the guard when the lint toolchain supports a newer compiler.

## Protected production environment

The environment named exactly `production` exists and accepts deployments only from the `main` branch. The release
and rollback workflows target it and share the `production-release` concurrency group.

GitHub returned the following plan boundary when branch protection, rulesets and environment reviewer protections
were requested for the private repository:

```text
Upgrade to GitHub Pro or make this repository public to enable this feature.
```

Consequently, `main` does not yet enforce pull requests or required CI checks, the environment has no required
reviewer, and environment administrators can bypass it. The preferred resolution is GitHub Pro while retaining the
private repository. Making the source public is a separate product/security decision and must not be used merely to
avoid the plan requirement.

## Secret inventory

| Name                    | GitHub location            | Current state | Required scope / handling                                                                |
| ----------------------- | -------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | `production` environment   | Pending       | Cloudflare Account / Cloudflare Pages / Edit for the Pixavelo account; rotate by policy. |
| `CLOUDFLARE_ACCOUNT_ID` | `production` environment   | Installed     | Treat the 32-hex identifier as sensitive operational metadata.                           |
| `GITHUB_TOKEN`          | Automatic per workflow run | Active        | No stored value; workflow permissions remain least-privilege.                            |

Do not create a Cloudflare global API key. Pixavelo has no application runtime secrets, upload credentials, analytics
key or account backend. The missing Pages token blocks release and rollback workflow execution; it does not block the
read-only production monitor.

## Operations evidence

The successful manual production-operations run retained one endpoint artifact and five browser artifacts through
2026-11-23 UTC. Aggregating those artifacts with the local baseline produced seven verified observations: two
availability observations, one privacy observation, no failed availability/privacy/release-integrity/latency
objective, and an explicitly incomplete 30-day window.

The first operations run exposed a source-less Firefox runtime diagnostic, correctly opened issue `#2`, and retained
failure evidence. The monitor was narrowed to annotate only that exact source-less Firefox diagnostic while still
failing every application-sourced warning or error. The subsequent run passed and closed the incident with a recovery
link. This proves escalation and recovery routing without rolling back or modifying production.

## Activation verification

Use names-only secret listing and API settings checks; never print the token value.

```bash
git remote -v
gh auth status
gh api repos/tomrider2008-maker/pixavelo/actions/permissions
gh api repos/tomrider2008-maker/pixavelo/actions/permissions/workflow
gh api repos/tomrider2008-maker/pixavelo/environments/production
gh secret list --repo tomrider2008-maker/pixavelo --env production
gh run view 32879256015 --repo tomrider2008-maker/pixavelo
gh run download 32879256015 --repo tomrider2008-maker/pixavelo --pattern "production-observation-*" --dir tmp/slo-ledger
npm run report:slo -- --input docs/evidence/phase13 --input tmp/slo-ledger
```

Confirm the first actual hourly `schedule` event and the first daily `schedule` event separately. Do not describe
scheduling as operationally observed until both records exist. Exercise future failure escalation only with a safe
preview or a naturally failing check; do not deliberately break the canonical production URL.
