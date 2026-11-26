# Production migration transport — prepared, NOT authorized to execute

Dominik, 25 November 2026. Draft PR73, unpublished candidate v4.51.123 RC.
The application authority remains disabled. No production Firebase connection was made.

## One existing migration sequence, two transports

`series-trusted-migration.cjs` keeps its original emulator entry point and conversion,
quiescence, intent, conditional create, ACK/readback, conflict and restart sequence.
`createProduction` routes those same operations through
`series-migration-production-transport.cjs`. The transport pins the explicit project
and database to the configured production application, the approved source index/ID,
and only GET source/target plus one conditional PUT at that target. No collection/root
PUT, PATCH, DELETE, Rules deployment, migration exception, redirect or network retry.

The operator entry point is `scripts/series-production-migration.cjs`. Its default is
**offline plan**, not a cloud read. Even a cloud dry-run requires separately approved
read access; importing or constructing the transport does not load credentials or
contact Firebase. Apply additionally requires a reviewed exact source ETag/hash,
target absent ETag/hash, fresh Rules/metadata inventory, snapshot manifest digest,
second-reviewer evidence and the existing four-class writer-quiet attestation.
The approval and quiet expiry are rechecked after credential preparation before PUT.

## Credentials and effective authority

The operator selects an existing Firebase CLI account explicitly. The provider uses
CLI's normal account preparation and OAuth refresh in memory, not manually copied
tokens, service keys, environment token values or configuration-store parsing.
CLI debug HTTP logging is disabled in this dedicated process. Identity/project must
match the reviewed principal. IAM checks fail closed: `firebase.projects.get` and
`firebasedatabase.instances.get`, plus `firebasedatabase.instances.update` for PUT.
The tolerant CLI `requirePermissions` wrapper is deliberately not used as proof.
These are API permission checks, NOT proof the principal has no additional grants.

Use the least-privileged available approved account; do not grant a project Owner
role just to run this tool. Existing wider IAM access and administrative Rules bypass
must be explicitly accepted for the bounded window. RTDB/IAM does not provide per-path
IAM restrictions merely because this code has a path allowlist. Other Console/Admin SDK
writers must be paused separately; Rules cannot stop them. No IAM changes are automated.
Provider integration was checked with the installed Firebase CLI v15.37.0 against the
test project only, without a database request. Actual production principal/permissions
remain to be verified after a separate read-access approval.

## Private input files

The CLI requires explicit `--project` and `--database-url` matching the production
configuration. `--config` must be an absolute private file outside the repository.
Allowed config keys only:

```json
{
  "principal": "operator@example.invalid",
  "sourceIndex": 0,
  "seriesId": "s",
  "readApprovalFile": "C:/PRIVATE/read-approval.json",
  "writeApprovalFile": "C:/PRIVATE/write-approval.json",
  "quiescenceFile": "C:/PRIVATE/quiet.json",
  "auditFile": "C:/PRIVATE/migration.jsonl",
  "evidenceDir": "C:/PRIVATE/receipts",
  "firebaseToolsDir": "C:/PRIVATE/runtime/node_modules/firebase-tools"
}
```

Read approval: `approved`, `approvalId`, exact `projectId`, `databaseUrl`, `principal`,
`sourceIndex`, `seriesId`, `expiresAt`, `administrativeBypassAcknowledged`. Without
`approved: true` no read is possible. The local file is an execution guard, not a
cryptographically independent approval authority. A project owner must actually
approve its contents; do not generate an approval merely to satisfy the guard.

Write approval repeats that identity/selector and adds `sourceHash`, `sourceEtag`,
`targetHash`, `targetEtag`, `sourceRulesVerified`, `writerQuietReviewed`,
`independentReviewerApproved`, `metadataInventoryVerified`, `snapshotManifestSHA256`,
`reviewerEvidenceRef`. The four verified flags must be true; hashes/ETags must match
the plan. Snapshot metadata review must establish native priorities are absent or
stop: this conversion does not silently migrate native priority metadata as fields.
Do not substitute an old console export for a fresh authorized server snapshot.

No new approval files with `approved: true` were created for production preparation.
The existing emulator CLI remains unchanged. Production modes:

- no `--mode`, or `--mode plan`: offline plan, zero cloud requests;
- `--mode dry-run`: separately approved source/target GETs and private receipts, no PUT;
- `--mode apply`: separately approved one conditional create and verification;
- `--mode verify`: same journal, read-only inspection after any prior intent.

Every invocation still needs explicit project/database/config selection. Apply never
automatically follows dry-run; do not repeat an uncertain attempt with a new journal.

## Independent evidence

The existing private fsynced intent journal still controls repeat prevention. The
production transport additionally writes exact successful response bytes (source,
ACK and target readback), real ETags, SHA256 and successive immutable manifests in
the private evidence directory. Filenames are unique and exclusive-create; directories
resolve outside the repository. No request Authorization, token, refresh token or
credential object is included. Error bodies are not persisted.

`scripts/series-migration-verify.py SOURCE_JSON TARGET_JSON NEW_REPORT_JSON` independently
compares every source property, owner, ACL, numeric reference index/order, history,
scoring and unknown nested value with the target envelope. It imports no application
encoder/decoder/hash implementation. Source input may be one raw series response or
the legacy appData export; target may be one raw target response or a target map.
Manifest receipts are raw response JSON, not wrapped snapshots. Retain source wrappers
and their metadata separately when extracting values. Only normal RTDB null/empty and
numeric-map/array representation is normalized; original indices are never renumbered.
The report records input file hashes and is exclusive-create. It does not infer results,
deduplicate links or authorize a migration.

A second person must independently retain the original files/manifests and run this
checker. Local hashes/immutable filenames alone do not prevent a privileged operator
from replacing the whole directory. Independent custody is a required operational
handoff, not a newly claimed cloud audit service. The checker is not evidence that
missing historical tournament models have been restored.

## Minimal cutover and stop sequence — requires separate approvals

1. Approve operator/access, independent reviewer, exact lock policy, window and
   temporary feature restrictions. Prepare compatible read-only recovery behavior.
2. Pause ordinary clients, old tabs, system admins and Console/Admin SDK/jobs;
   separately publish the reviewed lock. Prove quiet, not just checkbox assertions.
3. After approved production read access, obtain current complete snapshots with
   ETags and current published Rules/metadata. Reconcile all nine original indexed
   references; retain seven known historical gaps, do not add November.
4. Approved cloud dry-run, independent comparison and second-custodian manifest
   handoff; separately approve the exact resulting one-create plan.
5. One conditional create, direct ACK and fresh source/target/source checks; use
   independent checker on actual full readback. On any conflict, timeout, source
   change, audit or verification failure STOP and retain lock/data/journal.
6. After successful verification and explicit approvals, publish operation B,
   merge/deploy the compatible activated client, verify version/assets and
   authoritative series/FC reads, end temporary migration access, release writers.
7. Any new business changes (including linking November) require their own authority.

No automatic cleanup/rollback. Before activation retain both authorities unchanged
on failure. After new-authority writes, use a compatible read-only client and preserve
all new data; do not restore an old backup, re-enable root writes or simply switch
the authority flag off. Uncertain writes are inspected with the original journal;
GET equality is not an operation receipt, and absence cannot revoke an in-flight PUT.

## Verification of this addition

- Nine new local transport contracts and six existing core contracts: PASS.
- Full production Node suite: 459 PASS, 0 FAIL, 3 SKIP (existing environment skips).
- Existing fifteen actual loopback engine scenarios: PASS, unchanged expectations.
- Same first-copy scenario through new transport routed only to loopback engine:
  one PUT, all nine indexed links/unknown fields, independent Python checker PASS.
- Actual existing CLI identity + IAM read check: test project only, zero RTDB calls.
- Closed four-test live Auth/Rules evidence retained, not repeated.
- Initial sandbox socket failures were environment failures; rerun used loopback
  permission. No product expectation was weakened. No new cloud writes occurred.

This removes the missing-transport implementation blocker. Actual production access,
fresh evidence, independent custody, writer quiet, lock/migration/Rules/release
approvals remain operational gates. No production action is authorized by this file.
