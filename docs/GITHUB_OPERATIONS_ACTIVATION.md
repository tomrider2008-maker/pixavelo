# GitHub Operations Activation

The repository is GitHub-ready but is not GitHub-active. The Phase 13 audit found no Git remote, so no workflow,
schedule, Dependabot update, protected environment or issue escalation has executed. Complete these steps only with
the approved GitHub repository and organization policy in hand.

## Remote and Actions path

Verify the destination before adding it; do not paste these placeholders literally.

```bash
git remote add origin git@github.com:<owner>/pixavelo.git
git remote -v
git push -u origin main
```

Enable Actions for the repository, allow the pinned first-party actions used under `.github/workflows/`, and keep the
default workflow token read-only. The production-operations, release and rollback workflows elevate only `issues:
write` for auditable failure escalation. Keep third-party actions disallowed unless they are reviewed and pinned to a
full commit SHA.

Protect `main` with pull requests, required CI checks, resolved conversations and blocked force pushes/deletions.
Require the `quality` and five `browser-smoke` matrix results before merge. Administrators should not bypass these
rules during ordinary releases.

## Protected production environment

Create a GitHub environment named exactly `production`, then configure:

- required production reviewers and prevention of self-review;
- deployment branches restricted to protected `main`;
- no environment administrator bypass for routine release or rollback;
- the Cloudflare values below as environment secrets, not repository files;
- reviewer evidence retained with each release or rollback run.

The release and rollback workflows already target this environment and share the `production-release` concurrency
group. Creating the environment is an external GitHub administration step and cannot be proven by repository files.

## Secret inventory

| Name                    | GitHub location            | Required scope / handling                                                     |
| ----------------------- | -------------------------- | ----------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | `production` environment   | Cloudflare Account / Pages / Edit for the Pixavelo account; rotate by policy. |
| `CLOUDFLARE_ACCOUNT_ID` | `production` environment   | The 32-hex account identifier; treat as sensitive operational metadata.       |
| `GITHUB_TOKEN`          | Automatic per workflow run | No stored value. `issues: write` is used only by failure-escalation steps.    |

Do not create a Cloudflare global API key. The application has no runtime secrets, upload credentials, analytics key
or account backend.

## Schedules, retention and escalation

`production-smoke.yml` declares an endpoint probe at minute 17 of every UTC hour and a five-project browser run at
03:15 UTC daily. Each run emits digest-protected SLO observations. Endpoint, browser, failure and release evidence is
retained for 90 days. A failing production operation opens or updates the single
`[Pixavelo] Production operations failure` GitHub issue and links the workflow run.

Dependabot checks npm and pinned GitHub Actions weekly on Monday. Schedules and Dependabot start only after the files
exist on the default GitHub branch with Actions enabled.

## Activation verification

After the remote and environment are configured, run and retain the output of:

```bash
gh workflow list
gh workflow run "Production operations" -f target_url=https://pixavelo.pages.dev -f expected_revision=8b235d47744a25ee0254ddd0282db56549366eab
gh run list --workflow "Production operations" --limit 5
gh run watch <run-id> --exit-status
gh run download <run-id> --pattern "production-observation-*" --dir tmp/slo-ledger
npm run report:slo -- --input docs/evidence/phase13 --input tmp/slo-ledger
```

Confirm the manual run, the next hourly run and the next daily run separately. Do not describe the schedules as active
until those three run records exist. Exercise escalation with a controlled failing preview target; do not deliberately
break the canonical production URL.
