# Domain Layer Map

This directory owns the pure TypeScript contracts and deterministic behavior shared by later MS-01 phases.

## Public Modules

- `identity.ts`: branded entity IDs, UTC timestamps, and sit-down date constructors.
- `money.ts`: branded safe-integer cents, strict parsing/formatting, and guarded arithmetic.
- `types.ts`: app settings, account, session, draft/final record, and audit-entry models.
- `calculations.ts`: payment resolution and source-asset projections.
- `thresholds.ts`: threshold validation, inheritance/override resolution, and state classification.
- `validation.ts`: draft versus stand-up completeness checks plus non-blocking financial warnings.
- `selectors.ts`: saved-snapshot account history datapoints.
- `index.ts`: intentional public barrel re-exported by `$lib`.

`test-fixtures.ts` contains the canonical roadmap scenario for tests and is not part of the public barrel.

## Invariants

- Money is always a branded safe integer count of cents; parse decimal text without floating-point arithmetic.
- Missing draft fields warn, while the same calculation-critical omissions block standing up.
- Financially messy numeric outcomes warn without blocking; invalid references and duplicate liability payments are errors.
- A duplicate liability payment makes the entire asset projection untrusted.
- Full- and statement-balance modes clear the remaining statement balance; custom mode preserves signed subtraction.
- Threshold boundaries are strict `below` checks: warning equality is healthy and danger equality is warning.
- History comes only from saved `AccountRecord` snapshots joined to non-draft sessions; never infer transactions.

## Change Rules

- Keep this layer independent of Svelte, browser storage, and route orchestration.
- Add or update deterministic unit tests for every changed money, validation, threshold, or selector rule.
- Preserve stable issue codes and public field names once cockpit or persistence code consumes them.
