# Series cutover readiness — specification, no production adapter

Dominik, 25 November 2026. Draft PR #73, candidate v4.51.123 RC, authority **disabled**.
This document does not authorize publishing Rules, migrating, activating or deploying.

## Activated-client history notice

The detail and result overview show a dynamic missing-history notice only after a complete
current-session tournament collection read. The evidence is not saved as an authoritative
cache. Initial/pending reads show verification in progress; a failed latest read shows that
availability cannot be verified, never a missing-tournament count. Overlapping older responses
cannot publish over the latest read; account/profile/role/generation changes invalidate evidence.

Missing means a linked ID is absent from the successfully loaded collection, not that its
existing tournament is unfinished. References and their order are never modified. Available
points use the existing calculation. Restoring a full tournament under its original ID and
refreshing updates the warning and visible points. Targeted updates preserve scoring drafts.
The legacy disabled-authority loader keeps its earlier behavior, including its existing
historical repair side effects; no general data-layer extraction or 10b1 is included.

## Proposed production authorization interface — NOT IMPLEMENTED

There is no executable production transport or credential provider in this PR. The current
trusted migration tool remains loopback/demo-only. The following describes a future reviewed
boundary, not methods that can be invoked now:

| Proposed operation | Explicit constraints |
|---|---|
| `readApprovedSnapshots(readApproval)` | GET only, separately approved exact `/appData`, `/tournamentSeries`, `/tournaments` paths; capture complete bytes, genuine ETags and hashes privately |
| `readSource(sourceApproval)` | GET exact approved numeric legacy series index; full source, real ETag, exact series ID and source digest |
| `inspectTarget(targetApproval)` | GET only the one stable `/tournamentSeries/{approvedId}` path |
| `prepareCopy(snapshotManifest)` | Offline encode/decode plus independent full-field/hash review; default dry-run, no network mutation |
| `createApprovedSeries(singleUseApproval)` | At most one conditional PUT, only absent approved target, matching target ETag, exact reviewed body digest; no retry |
| `verifyAttempt(attemptId)` | GETs only; source checks and target comparison; equality is not an operation receipt |

Pinned project `bc-rybarna-scrbrd` and database origin
`https://bc-rybarna-scrbrd-default-rtdb.europe-west1.firebasedatabase.app` must be checked
against the project-owner's current console evidence and the authorization principal.
No caller-controlled host, redirect, encoded path escape, arbitrary suffix, wildcard write,
DELETE, PATCH or root PUT. Read approvals cannot be upgraded into write approvals.

A proposed single-use approval binds project/database, operator and reviewer, source path/ID,
source ETag/hash, target path/absent ETag, exact body hash, Rules revision, writer-quiet evidence,
audit destination, expiry and operation ID. Source/target checks remain non-atomic; source
writer quiet is a prerequisite. Conflicts, expired approvals, unknown ACK or audit failure stop.
No production implementation or signing/approval authority is provided here.

### Identity, IAM and independent audit

Prefer a separately approved dedicated workload identity or short-lived service-account
impersonation in a controlled execution environment. No downloaded service-account keys,
credentials in project configuration, token input fields, persisted bearer values or HTTP
debug logs. The adapter's future credential provider exposes a scoped request capability,
never returns credentials to the UI or manifests. The authenticated human and impersonated
service identity must both be attributable. Short-lived credentials reduce persistence risk;
their expiry and removal of grants must be verified, not assumed to revoke a sent request.
[Google Cloud impersonation](https://docs.cloud.google.com/iam/docs/service-account-impersonation).

An administrative database identity can bypass client Rules. A code path allowlist does not
turn broad IAM access into per-path IAM enforcement. If broad administrative access is
necessary, the project owner must explicitly accept that residual risk, approve the shortest
execution window and least available permissions, restrict who can impersonate the identity,
stop other admin writers and remove temporary grants afterward. An auth override is not proof
that the underlying credential lacks bypass capability.
[Firebase administrative access](https://firebase.google.com/docs/database/admin/start).

The existing local hash-chained audit is not independent evidence against a privileged
operator. A future production design needs a separately controlled append-only audit sink
or independently retained/signed manifest and second-person verification of source, payload
and readback. Prove log coverage for the chosen RTDB/identity path in an authorized test
environment; do not assume every REST data operation has an independently usable cloud log.
No independent production audit integration is implemented here.

## Owner actions versus isolated automation

| Gate | Project-owner/manual evidence required | Isolated automation available |
|---|---|---|
| Actual Auth | Approve isolated test project/identities and faithful private Rules; verify authenticated/verified owner, manager, admin, stranger and logged-out roles | Emulator tests use synthetic JWTs, not live Auth proof |
| Current Rules revision | Open exact production project/database Rules tab; confirm published revision/time, no unsaved draft; privately save/download and hash actual published JSON | Local byte/semantic/hash comparison; emulator policy tests |
| Fresh snapshots | Explicit read approval, authorized session, confirmed writer quiet, private destination | Prepared GET-only helper captures genuine ETags; console files alone are preliminary |
| Writer quiet | Confirm ordinary clients locked, system admins stopped, old clients ended, console/IAM/Admin SDK jobs inventoried and paused; record owners/times/evidence | Tests verify client Rules; no automatic proof of administrative quiet |
| Source integrity | Review all nine ordered references, owner/ACL/scoring/history/unknowns and accepted historical gaps against fresh source | Offline roundtrip, manifest, checksum and points comparisons |
| Migration lock | Separately approve exact private policy/hash and its operational impact; owner publishes and checks it | Local engine only; no rejected exception needed for trusted emulator bypass |
| Actual migration | Separate concrete write approval, privileged principal/risk acceptance, independent audit and one target | Current executable cannot connect to production |
| Operation B | Separate approval/publication and hash verification; remove temporary writer capabilities | Local positive/negative policy tests |
| Compatible client | Approve blocked-function matrix, actual version, activation and deployment; keep old writers blocked | Mocked/browser checks of active build and module bootstrap |
| Final inspection | Approve read-only real Lounska/FC check; no test writes in production | Isolated points, notices, FC child writer/refresh regressions |

Order: permissions/Auth and scope review → notice/window and writer inventory → separately
approved lock and proof of quiet → fresh snapshots/Rules → full source/hash/dry-run review →
separate migration approval → single conditional copy/readback and source rechecks → separate
operation-B approval and temporary-identity cleanup → separately approved compatible client
activation → read-only Lounska and Federal Cup inspection. Any failed gate means STOP.
After new data exists, return with compatible read-only code; do not restore an old database.

## Temporary restrictions — release decision still required

| User action after activation | Prepared behavior | User-visible alternative / scope |
|---|---|---|
| Delete whole series | Blocked, no DELETE | Keep series; linking/unlinking completed tournaments remains available |
| Import whole application backup | Blocked before applying file | Export current new-authority data remains available |
| Restore legacy application snapshot | Blocked before overwriting state | No stale snapshot can become new series authority |
| Edit reconstructed historical bracket | Blocked before plan/persist | Existing data remain readable; supported simple history entry is separate |
| Auto-link an unfinished new tournament | Selector disabled; restored pending linked attempt explicitly blocked | Add an existing completed tournament explicitly after completion |
| Add/remove completed tournament | Available to authorized owner/manager/admin with ETag | Unrelated tournaments/results are unchanged |
| Change scoring | Available to authorized owner/manager/admin with stale-editor/ETag checks | Series rules remain independent |

The code already enforces these transition guards, but release acceptance of their temporary
unavailability is **pending**, not inferred from approval of preparation. They must be
included in the deployment decision and user announcement.

## Remaining production blockers

Production adapter/identity design and explicit implementation approval; independent audit;
actual isolated Auth/Rules test; current Rules and complete post-lock ETag snapshots; verified
administrative writer quiet; acceptance of temporary restrictions and incomplete history;
separate lock/migration/operation-B/client activation approvals. This specification does not
remove those gates or turn the emulator tool into a production writer.
