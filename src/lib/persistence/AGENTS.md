# Persistence Map

This subtree owns browser persistence boundaries and the IndexedDB implementation for MS-01.

## Public Modules

- `configuration-repository.ts`: repository interface, input contracts, and stable repository errors.
- `sit-down-draft-repository.ts`: normalized unfinished-session snapshot contract and draft repository boundary.
- `indexeddb-helpers.ts`: shared request, transaction, and versioned database-open helpers.
- `schema.ts`: database name, version, stores, singleton settings ID, and ordered migrations.
- `records.ts`: strict validation of unknown persisted configuration records.
- `indexeddb-configuration-repository.ts`: transactional configuration implementation.
- `indexeddb-sit-down-draft-repository.ts`: atomic draft session/account/payment upsert and latest-draft resume implementation.

## Invariants

- The database is named `stashy`; schema version 2 adds normalized draft session, account-record, and payment-record stores with relationship indexes.
- `appSettings` contains one stable settings record, while `accounts` contains active and archived accounts.
- Every read validates persisted data. Corruption and unsupported schema values are reported, never reset.
- Account names are globally unique case-insensitively, including archived accounts.
- Reordering swaps active neighbors transactionally and leaves archived positions intact.
- Draft saves replace one session's child-record set in a single transaction, preserve IDs and creation times, and update edit timestamps without creating audit entries.
- Browser globals are injected so unit tests can use an isolated fake IndexedDB factory.
