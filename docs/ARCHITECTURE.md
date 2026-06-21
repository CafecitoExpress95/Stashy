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
- Current IndexedDB version: `2`. The persisted `AppSettings.schemaVersion` remains `1`.
- Object stores use plural domain names except the singleton `appSettings` store. Version 2 contains `appSettings`, `accounts`, `sessions`, `accountRecords`, and `paymentRecords`.
- The singleton settings record uses one stable UUID for every installation.
- Upgrade functions are ordered by target version and only perform changes introduced by that
  version.
- A future schema change must increment the database version, append an upgrade function, preserve
  existing records, and add migration tests before release.
- Persisted records are validated when read. Unsupported or corrupt data is reported and is never
  silently discarded or reset.

## Phase 3 Draft Persistence Boundary

Phase 3 brought forward the minimum durable workflow needed for meaningful cockpit testing:

- `SitDownDraftSnapshot` stores one unfinished `Session` with flat `DraftAccountRecord` and
  `DraftPaymentRecord` children linked by stable IDs.
- Explicit **Save Draft** replaces that session's child-record set in one IndexedDB transaction.
- Reload resumes the most recently updated draft and resolves account names from current account
  configuration; it does not silently add accounts configured after the draft began.
- Draft saves update edit timestamps, preserve creation timestamps and record IDs, and create no
  audit entries.
- Blank statement balances remain absent in draft records. Full and custom payments can still resolve,
  while Statement payment mode requires a value. Completed payment snapshots use nullable statement
  values and never store a negative remaining statement balance.
- Stand Up performs strict completeness validation in Phase 3 but does not persist a completed
  session or change `isDraft` to `false`.

Phase 4 owns completed-session persistence, final snapshot guarantees, lifecycle/status hardening,
interrupted-write recovery, migration coverage beyond the version-1-to-version-2 draft migration,
and any additional indexes required by archive or history queries.
