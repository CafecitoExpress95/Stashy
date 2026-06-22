# Stashy Architecture and Decision Record

This document records MS-01 decisions that affect persisted data and establishes naming and
migration conventions. Product behavior remains governed by
[DESIGN_DOC.md](./DESIGN_DOC.md), and delivery requirements remain governed by
[MVP_ROADMAP.md](./MVP_ROADMAP.md).

## Approved MS-01 Product Contract

The ten proposed decisions in the roadmap are approved:

1. Money is stored as integer cents and formatted at the UI boundary.
2. MS-01 uses one app-wide currency: USD.
3. Asset thresholds use ordered `warningBelow` and `dangerBelow` boundaries.
4. Import will be a validated full restore, not a merge.
5. Drafts are intentionally incomplete; stood-up sessions may omit confirmation IDs and notes.
6. Historical records resolve account IDs to the account's current name.
7. Same-date sessions remain distinct through creation time and ID.
8. Saved-session edits create before-and-after audit snapshots; draft autosaves do not.
9. Whiteboard latest state ignores drafts.
10. Archive provides newest-first listing and full replay; advanced search is deferred.

Phase 2 additionally fixes manual account ordering, globally unique case-insensitive account names,
disabled defaults for a new installation, and inherited threshold policy for new assets. Phase 3
allows statement balances to be omitted except for Statement payment mode; resolved payment snapshots
store nullable statement values and floor present remaining statement balances at $0.00.

## Deployment Assumptions

- The application is prerendered and hosted as static files.
- IndexedDB is the source of truth and is scoped to the browser origin.
- Direct `file://` execution is unsupported.
- A production deployment uses a stable HTTPS origin.
- Production code must not require network access or a server-side database.

## Naming Conventions

- Domain records are plain singular nouns such as `Account` and `AppSettings`.
- Repository interfaces use the capability name plus `Repository`, such as
  `ConfigurationRepository`.
- Browser persistence implementations use an `IndexedDb` prefix.
- Services describe a user-visible capability and do not duplicate repository responsibilities.
- Reusable Svelte components use PascalCase filenames.
- Routes use product language and remain responsible for screen orchestration only.

## IndexedDB Schema and Migrations

- Database name: `stashy`.
- Current IndexedDB version: `3`. The persisted `AppSettings.schemaVersion` remains `1`.
- Object stores use plural domain names except the singleton `appSettings` store. Version 3 contains `appSettings`, `accounts`, `sessions`, `accountRecords`, `paymentRecords`, and `auditEntries`.
- The singleton settings record uses one stable UUID for every installation.
- Upgrade functions are ordered by target version and only perform changes introduced by that
  version.
- A future schema change must increment the database version, append an upgrade function, preserve
  existing records, and add migration tests before release.
- Persisted records are validated when read. Unsupported or corrupt data is reported and is never
  silently discarded or reset.

## Phase 4 Sit-Down Lifecycle Persistence

Phase 4 extends the normalized Phase 3 records through one `SitDownRepository` boundary:

- `SitDownDraftSnapshot` stores intentionally incomplete records. `StoodUpSitDownSnapshot` stores
  complete `AccountRecord` and `PaymentRecord` snapshots with `Session.isDraft` set to `false`.
- Draft and Stand Up operations replace one session and its child set in one IndexedDB transaction.
  Stable IDs and creation timestamps are preserved; edit timestamps advance only after a committed write.
- Writes are serialized. A failed or interrupted transaction leaves the previous committed snapshot
  intact, while the route keeps current text input available for retry.
- Valid edits autosave after an 800 ms quiet period. **Save Draft** remains as an immediate explicit
  flush, and invalid date or money text pauses autosave without overwriting the last valid draft.
- Stand Up validates completeness, asks for confirmation, waits behind any earlier draft write, and
  saves the resolved opening/final account balances and payment results atomically.
- Blank confirmation IDs and notes are valid final data. Omitted statement balances are stored as
  `null`; supplied remaining statement balances retain the zero floor.
- Reload opens the newest session by sit-down date, creation time, and ID so correcting old history cannot replace the current workflow. Drafts return to the editable cockpit; stood-up sessions return to a read-only completion receipt until **Start New Sit-Down** commits a new blank draft.
- Version 3 removes the low-value boolean `isDraft` index, keeps the chronological `updatedAt` index,
  and creates the empty `auditEntries` store with entity and chronology indexes for Phase 5 editing.
- Version 1 and version 2 databases migrate in place. Persisted records are validated according to
  their draft or completed lifecycle and corrupt data is surfaced rather than reset.

## Phase 5 Archive and Historical Corrections

Phase 5 extends the same normalized records and schema version 3:

- Archive lists sessions by sit-down date, then creation time and ID, newest first. Updating an old session's edit timestamp does not move it above later sessions.
- Archive summaries use current account names, exact completed payment totals, and no total for intentionally incomplete drafts.
- Read-only replay and edit routes use query-string session IDs so the static deployment does not require runtime-generated route files.
- Drafts continue through the Phase 4 autosave and Stand Up lifecycle. Stood-up sessions disable autosave and require explicit **Save Corrections**.
- A completed correction preserves session and child IDs, record ownership, creation timestamps, and unchanged child timestamps. It cannot add/remove historical children or demote the session to a draft.
- Changed session, account, and payment records receive exact before/after audit entries in the same IndexedDB transaction as the correction. No-op corrections, draft saves, and initial Stand Up create no audit entries.
- Editing one session recalculates only that session's saved snapshots. Later manually entered sessions are never rewritten or flagged.
- Audit notes remain null in MS-01; a user-facing audit-history presentation is deferred.
