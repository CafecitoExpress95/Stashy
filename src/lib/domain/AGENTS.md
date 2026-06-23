# Domain Layer Map

This directory owns the pure TypeScript contracts and deterministic behavior shared by later MS-01 phases.

Read `README.md` for the domain data flow and a plain-language guide to the TypeScript notation used here.

## Public Modules

- `identity.ts`: branded entity IDs, UTC timestamps, and sit-down date constructors.
- `money.ts`: branded safe-integer cents, strict parsing/formatting, and guarded arithmetic.
- `types.ts`: app settings, ordered account, session, draft/final record, no-payment-capable payment modes, and audit-entry models.
- `configuration.ts`: account-name validation, ordering, active/archive selectors, and policy checks.
- `cockpit.ts`: raw form initialization, draft/completed snapshot hydration with stable IDs, exact parsing, snapshot assembly, live payment views, threshold states, and save/stand-up readiness.
- `calculations.ts`: payment resolution and source-asset projections.
- `thresholds.ts`: threshold validation, inheritance/override resolution, and state classification.
- `validation.ts`: draft versus stand-up completeness checks plus non-blocking financial warnings.
- `selectors.ts`: exact newest-first Archive summaries, newest stood-up Whiteboard state, and saved-snapshot account history datapoints.
- `index.ts`: explicit intentional public barrel re-exported by `$lib`; internal factories stay private.

`test-fixtures.ts` contains the canonical roadmap scenario for tests and is not part of the public barrel.

## Invariants

- Money is always a branded safe integer count of cents; parse decimal text without floating-point arithmetic.
- Missing draft fields warn, while the same calculation-critical omissions block standing up. Complete rows still contribute to live draft projections.
- Financially messy numeric outcomes warn without blocking; invalid references and duplicate liability payments are errors.
- A duplicate liability payment makes the entire asset projection untrusted.
- Statement balances are optional except for Statement payment mode. No-payment rows require only the liability account balance, store a zero-dollar payment without a source asset, and leave projections unchanged. Resolved omitted statement values are null, and paid-mode remaining statement balances floor at zero; only account balances remain signed.
- Threshold boundaries are strict `below` checks: warning equality is healthy and danger equality is warning.
- Archive summaries and history come only from saved snapshots; drafts have no completed payment total and history never infers transactions.
- Whiteboard latest state uses only the newest stood-up session; current names, archive state, and threshold settings decorate saved balances without filling gaps from older sessions.
- Account names are normalized and globally unique; `sortOrder` is a non-negative position scoped by account type.

## Change Rules

- Keep this layer independent of Svelte, browser storage, and route orchestration.
- Add or update deterministic unit tests for every changed money, validation, threshold, or selector rule.
- Preserve stable issue codes and public field names once cockpit or persistence code consumes them.
- Compose flat record types from small field fragments with intersections (`&`); do not introduce
  base domain classes, nested metadata wrappers, or inherited persistence state.
- Use module summaries and JSDoc for public APIs. Add inline comments for non-obvious domain intent
  or TypeScript mechanics, but do not narrate routine assignments line by line.
