# Phase 1 Domain Foundation Executive Walkthrough

Phase: **MS-01 Phase 1 - Exact Money and Domain Model**

Related artifacts: [executive summary](../summaries/2026-06-18-2126-phase-1-domain-foundation.md) | [test report](../reports/2026-06-18-2126-phase-1-domain-foundation.md)

## Tour Stop 1 - Exact Values at the Boundary

[`money.ts`](../../src/lib/domain/money.ts#L3) defines the branded safe-integer cent type and guarded arithmetic. [`parseMoneyInput`](../../src/lib/domain/money.ts#L58) accepts common strict USD input by parsing strings and rejects malformed grouping, unexpected precision, and overflow without rounding. Formatting also works directly from integer cents.

**Review prompt:** Try the accepted and rejected examples mentally and confirm they match what you expect to type or paste during a sit-down.

## Tour Stop 2 - Flat Records With Stable References

[`types.ts`](../../src/lib/domain/types.ts#L28) defines app settings, discriminated asset/liability accounts, sessions, draft and final records, and typed audit snapshots. Child records carry IDs rather than nested entities, and the sit-down date remains owned by the session.

**Review prompt:** Inspect the balance field names and confirm they tell the same story as the current sheet without needing spreadsheet context.

## Tour Stop 3 - Payment and Asset Math

[`calculatePayment`](../../src/lib/domain/calculations.ts#L15) resolves full, statement, and custom modes into final payment records. [`calculateProjectedAssetBalances`](../../src/lib/domain/calculations.ts#L133) groups deductions by source asset and refuses to return a projection when the same liability appears twice.

**Review prompt:** Confirm that full/statement modes clearing the remaining statement balance, while custom mode preserves signed subtraction, matches the real payment workflow.

## Tour Stop 4 - Passive Thresholds and Explicit Warnings

[`resolveAssetThresholds`](../../src/lib/domain/thresholds.ts#L27) implements inherit/custom/off settings, and [`getAssetThresholdState`](../../src/lib/domain/thresholds.ts#L43) applies strict below-boundary classification. [`validation.ts`](../../src/lib/domain/validation.ts#L298) exposes separate draft and stand-up entry points while preserving stable issue codes and every applicable financial warning.

**Review prompt:** Read the warning copy in context and flag anything that feels too vague, too legalistic, or too alarming for a stressful sit-down.

## Tour Stop 5 - Snapshot-Based History

[`selectAccountHistory`](../../src/lib/domain/selectors.ts#L41) joins saved account records to non-draft sessions, sorts them deterministically, uses current account names, and optionally attaches liability payment context. It does not fill missing sessions or derive a ledger.

**Review prompt:** Confirm that the final saved snapshot is the balance you want graphed for both assets and liabilities.

## Tour Stop 6 - Executable Product Contract

[`test-fixtures.ts`](../../src/lib/domain/test-fixtures.ts#L33) encodes the roadmap's Checking, Savings, and three-card scenario. The focused tests cover money, all payment modes, projections, validation, thresholds, IDs, and both account-history types. Vitest is wired through [`package.json`](../../package.json#L10).

**Review prompt:** Treat the canonical fixture as the product contract and call out any result that should change before UI work consumes it.

## End-to-End Flow

A future cockpit can parse text into exact cents, construct draft records, calculate complete payment rows, validate the session, project each source asset, classify its threshold state, and later save account snapshots that the history selector replays. Every step uses the same exported domain contracts and remains independent of Svelte and persistence.
