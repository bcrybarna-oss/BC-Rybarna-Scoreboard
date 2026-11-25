# Trusted series migration — emulator preparation only

Dominik, 25 November 2026. Draft PR #73, unpublished candidate v4.51.123 RC.
The rejected migration Rules exception is not used. Production authority stays disabled.

## Boundaries

`scripts/series-trusted-migration.cjs` is a Node.js administrative **emulator-only** tool.
Its endpoint is fixed to HTTP 127.0.0.1 and namespace `demo-pool-series`; only a local
port is configurable. It has no production host, credential, service-key or token option.
The reserved emulator `Bearer owner` bypass is used exclusively on that loopback target.
This is intentionally not a production-ready migrator or evidence of live Auth/Rules.

The tool defaults to dry-run. All requests are exact GETs of the source series and
target record, except one explicitly approved conditional PUT to an absent target.
No root upload, Rules deployment, PATCH, DELETE, repair, deduplication or retry exists.
It uses the existing production `encodeLegacy`/`decodeRecord`, not another data model.
The comparison canonicalizes only Firebase's null/empty/numeric-array representation.
No sport calculation or membership is changed. Source properties outside content,
including recursively unknown fields and embedded history, remain preserved.

## Sequence and results

1. Read complete source series plus real ETag; require exact embedded ID.
2. Encode and independently compare full decoded roundtrip against source.
3. Read target plus real ETag. A different or partial target blocks. An identical
   target needs no write; current equality is not an operation receipt.
4. Dry-run stops here with hashes. Apply additionally requires explicit emulator
   approval and current operator evidence for all four classes of paused writers.
5. Re-read source immediately before sending. Changed hash or ETag blocks the PUT.
6. Persist and fsync write intent **before** the request, then conditional target PUT
   using its absent-target ETag. Target conflicts never trigger another PUT.
7. Require direct matching ACK; read source, entire target and source again. Compare
   source ETags, complete hashes, decoded fields and the operator evidence expiry.
8. Only direct ACK plus these comparisons reports verified success. Source changes,
   failed readback, conflict, unknown response or audit failure stop the process.
   A created/partial/uncertain target is retained, never deleted or overwritten.

Source and target ETag checks are **not an atomic transaction across branches**.
Changes after the last source read cannot be excluded technically. Actual writer
quiet is a prerequisite, not a guarantee supplied by the attestation booleans.

## Audit and restart

Audit JSONL is mandatory, private and outside the repository. It contains hashes,
ETags, exact operation paths, chained record digests, timestamps and operator evidence
references, not source payloads or credentials. Each append is exclusive, fsynced and
checked against the previously observed file; interrupted/tampered/concurrently changed
audit blocks. SHA chains provide corruption detection, not a trusted digital signature.

Keep the same audit file for the operation. Never make a fresh audit to bypass an
uncertain attempt. Once write intent exists, `apply` is blocked, even after a successful
run or process restart. `verify` does GETs only and reports:

- `CURRENT_MATCHES_NOT_OPERATION_RECEIPT`;
- `ABSENT_NOT_PROOF_OF_NO_WRITE`;
- `CONFLICT_OR_PARTIAL_TARGET`, plus whether the source still matches.

None authorizes retry. A stale audit `.lock` or incomplete JSONL requires manual proof
that the writer ended and preservation/inspection of the original audit; no automatic
lock deletion, audit repair or reset is provided. A killed process may have committed.

## Isolated commands

Use a trusted local emulator, synthetic data and a private audit directory. Defaults:

```text
node scripts/series-trusted-migration.cjs --source-index 0 --series-id s --audit PRIVATE/audit.jsonl
node scripts/series-trusted-migration.cjs --mode apply --source-index 0 --series-id s --audit PRIVATE/audit.jsonl --approval "EMULATOR CREATE ONLY" --quiet-file PRIVATE/synthetic-quiet.json
node scripts/series-trusted-migration.cjs --mode verify --source-index 0 --series-id s --audit PRIVATE/audit.jsonl
```

The synthetic quiet file explicitly records `clientsLocked`, `systemAdminsPaused`,
`oldClientsStopped`, `adminProcessesPaused`, `attestedBy`, `evidenceRefs`, `expiresAt`.
They are test/operator assertions, never automatic verification of stopped Admin SDKs.

```text
node --test tests/series-trusted-migration.test.cjs
node tests/series-trusted-migration-emulator.cjs
node tests/series-trusted-migration-browser.cjs
```

The engine test requires the existing PRIVATE `SERIES_RULES_FILE` and local RTDB
engine. Fifteen real-engine scenarios include a real child killed after commit;
the separate production-browser calculation test covers expected independent points
for two completed tournaments, missing references, and a hypothetical complete original-ID
restoration without membership changes. It is a synthetic scenario, not restored history.
Full metadata/ACL/history tests are separate from the base zero-history fixture.

## Production gates — still blocked

A production adapter and its authentication/least-privilege design are **not implemented**.
Operator Dominik must separately approve the specific privileged identity, window and
cutover. IAM access is not per-path merely because application code uses exact paths;
Admin SDK/IAM bypass is not stopped by client Rules. Inventory and stop those processes
and all console/system-admin writers, not just ordinary and old clients. If their quiet
cannot be established, do not proceed. The private runbook details evidence and stop gates. See [authorization specification and owner checklist](series-cutover-readiness.md).

Fresh authorized post-lock snapshots with ETags, current Rules comparison, actual isolated
Auth/Rules verification, complete metadata/priority inventory, checksum review, private
audit storage and explicit approval are still necessary. Old console exports are only
reference inputs. Preserve unresolved links with an explicit warning; they are not verified
complete historical results. That warning is now implemented in the inactive candidate and browser-tested; acceptance of the incomplete-history presentation remains a release gate.
Any proposed production Rules publication, migration or client activation needs approval.
No production read/write or deployment is part of this preparation.

Before activation revert this preparation without data changes. After any future writes,
retain the new authority and use compatible read-only code; never restore an old database
backup or broad parent writer. A changed source/uncertain target means STOP, not rollback.
