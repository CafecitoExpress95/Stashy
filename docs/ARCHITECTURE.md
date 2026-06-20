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
disabled defaults for a new installation, and inherited threshold policy for new assets.

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
- Current database version: `1`.
- Object stores use plural domain names except the singleton `appSettings` store.
- The singleton settings record uses one stable UUID for every installation.
- Upgrade functions are ordered by target version and only perform changes introduced by that
  version.
- A future schema change must increment the database version, append an upgrade function, preserve
  existing records, and add migration tests before release.
- Persisted records are validated when read. Unsupported or corrupt data is reported and is never
  silently discarded or reset.
