# Persistence Map

This subtree owns browser persistence boundaries and the IndexedDB implementation for MS-01.

## Public Modules

- `configuration-repository.ts`: repository interface, input contracts, and stable repository errors.
- `sit-down-repository.ts`: draft/stood-up snapshot contracts plus list, load, lifecycle, and audited-correction repository methods.
- `indexeddb-helpers.ts`: shared request, transaction, and versioned database-open helpers.
- `schema.ts`: database name, version, stores, indexes, singleton settings ID, and ordered migrations.
- `records.ts`: strict validation for configuration, draft, completed, and before/after audit records.
- `indexeddb-configuration-repository.ts`: transactional configuration implementation.
- `indexeddb-sit-down-repository.ts`: newest-first Archive reads, stable-ID draft/final writes, and serialized atomic stood-up corrections with audit entries.

## Invariants

- The database is named `stashy`; schema version 3 contains normalized configuration, session, account-record, payment-record, and audit-entry stores.
- Version 3 removes the obsolete boolean draft index, adds the empty audit store required by Phase 5, and preserves version 1 and version 2 data through ordered migrations.
- `appSettings` contains one stable settings record, while `accounts` contains active and archived accounts.
- Every read validates persisted data. Corruption and unsupported schema values are reported, never reset.
- Account names are globally unique case-insensitively, including archived accounts.
- Reordering swaps active neighbors transactionally and leaves archived positions intact.
- Draft and Stand Up writes replace one session's child-record set atomically; a draft cannot demote a stood-up session.
- Completed corrections preserve IDs, ownership, creation times, and unchanged child timestamps; changed records and exact before/after audits commit together without touching later sessions.
- Final snapshots require resolved account/payment records; omitted statement balances are stored as `null` and present statement remainders never go below zero.
- Browser globals and the pre-commit failure hook are injected so tests can isolate IndexedDB and prove interrupted writes preserve the prior committed snapshot.
