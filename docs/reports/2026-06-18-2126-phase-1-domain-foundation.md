# Phase 1 Domain Foundation Test Report

MS-01 phase: **Phase 1 - Exact Money and Domain Model**

Related artifacts: [executive summary](../summaries/2026-06-18-2126-phase-1-domain-foundation.md) | [executive walkthrough](../walkthroughs/2026-06-18-2126-phase-1-domain-foundation.md)

## Scope

Verified the new pure TypeScript domain layer: branded IDs and timestamps, exact cent-based money, strict currency parsing and formatting, payment calculations, source-asset projections, threshold policies, draft/stand-up validation, saved-snapshot history selectors, public exports, and the Vitest harness.

## Automated Checks

- **Pass - `npm test`**: Vitest ran 6 files and 53 deterministic tests successfully.
- **Pass - `npm run check`**: Svelte Check reported 0 errors and 0 warnings.
- **Pass - `npm run lint`**: Prettier and ESLint passed across the repository.
- **Pass - `npm run build`**: Vite and adapter-static produced the production build successfully.
- **Pass - `git diff --check`**: no whitespace errors were reported.

## Observed Results

- `$100.10 - $0.10 - $0.20` resolves exactly to `$99.80` using integer cents.
- The canonical fixture projects Checking to `$324.80`, leaves Savings at `$500.00`, and classifies Checking as warning.
- Card A ends at `$200.10` account / `$0.00` statement; Card B ends at `$0.00` / `$0.00`; Card C ends at `-$0.10` / `-$15.10`.
- Card C returns all three applicable non-blocking warnings: overpayment, negative remaining account balance, and negative remaining statement balance.
- Duplicate liability payments are hard errors and produce no trusted asset projection.
- Draft omissions warn; the same calculation-critical omissions become errors when standing up.
- History selectors use only saved `AccountRecord` snapshots, exclude drafts, retain no-payment liabilities, cover assets and liabilities, and display current account names.

## Failures and Risks

- The first dependency install attempt could not write to the sandboxed user npm cache; the approved escalated retry succeeded.
- An initial fixture-only TypeScript inference error was corrected before final verification.
- `npm install` reported four low-severity dependency audit findings. No forced audit fix was applied because it could introduce unrelated breaking dependency changes.
- No browser UI or IndexedDB path exists in Phase 1, so integration behavior remains for later user-specified phases.
- Full- and statement-balance modes explicitly clear the remaining statement balance to satisfy the roadmap's canonical Card B result; Anthony should confirm that wording and mental model before cockpit work.

## Anthony's Tests

1. Confirm `startingAccountBalance`, `startingStatementBalance`, `remainingAccountBalance`, and `remainingStatementBalance` match the language used during a real sit-down.
2. Confirm full-balance and statement-balance modes should display a `$0.00` remaining statement balance, while custom payments may show a signed negative value.
3. Review the warning messages, especially the negative-payment and overdraft-risk wording, for usefulness without alarmism.
4. Confirm threshold boundaries: exactly `$400.00` is healthy, exactly `$100.00` is warning, and `$99.99` is danger in the canonical setup.
