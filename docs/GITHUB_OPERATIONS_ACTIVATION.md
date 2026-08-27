# GitHub Operations Activation

## Activation status

This repository is externally active at `https://github.com/tomrider2008-maker/pixavelo`. The product owner explicitly
authorized public source publication on 2026-08-27. `origin` tracks the public repository, GitHub Actions, Dependabot,
secret scanning and push protection are enabled, and `main` plus the `production` environment are protected. No
production deployment was performed by this activation.

State verified on 2026-08-27 UTC:

| Control                      | Status                              | Verifiable evidence                                                                                                                |
| ---------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Public GitHub remote         | Active                              | `origin` is `https://github.com/tomrider2008-maker/pixavelo.git`; visibility is API-verified as `public`.                          |
| Actions policy               | Active                              | GitHub-owned actions only, full-SHA pinning required, default token read-only, PR approval disabled.                               |
| Main CI                      | Passed                              | Run `33036366350` passed quality plus Chromium, Firefox, WebKit and both mobile profiles on revision `b3910e2…`.                   |
| Manual production operations | Passed                              | Run `32879256015` passed endpoint plus all five browser projects and retained six artifacts for 90 days.                           |
| Failure escalation           | Exercised and recovered             | Run `32878411383` opened issue `#2`; the successful recovery run was linked and the issue was closed.                              |
| Hourly/daily schedules       | Active; continuity incomplete       | Schedule events exist from 2026-08-25; failures and a later gap over 90 minutes prevent a claimable 30-day window.                 |
| Dependency/secret controls   | Active                              | Dependabot security updates, secret scanning and push protection are enabled; weekly npm/action updates are configured.            |
| Protected `main`             | Enforced                            | PR, one approval, last-push approval, six strict checks, conversations and linear history are required for administrators too.     |
| `production` environment     | Enforced; reviewer capacity pending | Protected branches only, required reviewer and self-review prevention are active; a second trusted collaborator is still required. |
| Cloudflare secrets           | Active                              | Both production-environment secrets are installed; the token was verified against the `pixavelo` Pages project.                    |

## Repository controls

Actions is restricted to GitHub-owned actions and every workflow action reference is pinned to a full commit SHA.
Verified and unverified third-party actions are disabled. The default `GITHUB_TOKEN` permission is read-only and
workflows cannot approve pull requests. Release, rollback and production-operations workflows elevate only the
permissions declared by their jobs.

Dependabot checks npm and pinned GitHub Actions weekly on Monday. TypeScript major versions `>=6.0.0` are temporarily
ignored because the current `typescript-eslint` peer range is `<6.1.0`; this prevents Dependabot from proposing an
uninstallable TypeScript 7 dependency set. jsdom major updates are also deferred because jsdom 30 drops the Node 20
runtime still declared by Pixavelo. Revisit both guards with the corresponding toolchain/runtime migrations.

## Protected production environment

The environment named exactly `production` accepts deployments only from protected branches. The release and rollback
workflows target it and share the `production-release` concurrency group. A reviewer is required and self-review is
prevented.

`main` requires a pull request, one approval, dismissal of stale approvals, approval by someone other than the last
pusher, resolution of conversations, strict success from `quality` and all five browser jobs, linear history, and no
force-push or deletion. Administrators are included. The repository currently has one collaborator, so a second
trusted collaborator must be added before an independent review or production approval can complete. Do not weaken
self-review prevention to work around that missing human control.

## Secret inventory

| Name                    | GitHub location            | Current state | Required scope / handling                                                     |
| ----------------------- | -------------------------- | ------------- | ----------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | `production` environment   | Installed     | Account-owned Pages Write token for the Pixavelo account; expires 2027-08-26. |
| `CLOUDFLARE_ACCOUNT_ID` | `production` environment   | Installed     | Treat the 32-hex identifier as sensitive operational metadata.                |
| `GITHUB_TOKEN`          | Automatic per workflow run | Active        | No stored value; workflow permissions remain least-privilege.                 |

Do not create a Cloudflare global API key. Pixavelo has no application runtime secrets, upload credentials, analytics
key or account backend. The account-owned token was verified with a read-only request that returned the `pixavelo`
Pages project and production branch `main`; no deployment or rollback was invoked.

## Operations evidence

The successful manual production-operations run retained one endpoint artifact and five browser artifacts through
2026-11-23 UTC. Actual scheduled runs began on 2026-08-25. Several scheduled runs failed on 2026-08-26 and the latest
observed sequence later exceeded the 90-minute endpoint-gap limit. These are real operational observations, but they
cannot be represented as a continuous or claimable 30-day window.

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

Review schedule continuity and the daily privacy artifact separately. A new 30-day window starts only after the latest
failure or excessive evidence gap and remains unclaimable until the reporter returns `claimable30DayWindow: true`.
Exercise future failure escalation only with a safe preview or a naturally failing check; do not deliberately break
the canonical production URL.
