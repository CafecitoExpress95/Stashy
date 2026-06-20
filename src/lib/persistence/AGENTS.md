# Persistence Map

This subtree owns browser persistence boundaries and the IndexedDB implementation for MS-01.

## Public Modules

- `configuration-repository.ts`: repository interface, input contracts, and stable repository errors.
- `schema.ts`: database name, version, stores, singleton settings ID, and ordered migrations.
- `records.ts`: strict validation of unknown persisted configuration records.
- `indexeddb-configuration-repository.ts`: transactional native IndexedDB implementation.

## Invariants

- The database is named `stashy`; schema changes increment the version and append a migration.
- `appSettings` contains one stable settings record, while `accounts` contains active and archived accounts.
- Every read validates persisted data. Corruption and unsupported schema values are reported, never reset.
- Account names are globally unique case-insensitively, including archived accounts.
- Reordering swaps active neighbors transactionally and leaves archived positions intact.
- Browser globals are injected so unit tests can use an isolated fake IndexedDB factory.
