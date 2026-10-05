# Phase 8 acceptance and follow-ups

Active work: **Phase 8 Slice A**, authorized by Anthony on October 4, 2026. Baseline: `8eab451`.
Slice A implementation and automated verification are complete; Anthony's review remains pending.
Phase 8 and MS-01 remain incomplete. Nothing was published.

## Slice A behavior delivered

- Missing-source warnings appear immediately in every paid mode, including empty Custom entry.
- Available deductions remain exact. Missing attribution marks all available sources partial;
  known-source omissions affect that source only. A missing/invalid opening never hides another source's overdraft.
- Partial results lose reassuring Healthy presentation. Negative and zero warnings remain visible.
- Rail/dock warning actions focus existing controls without stealing focus during mode selection.
  One live region announces new projection problems and preserves messages during ordinary typing.
- Invalid dates and optional statement text pause saving independently of valid money results.
- Draft replay derives running balances from saved inputs and identifies unassigned paid rows.
  Completed snapshots, historical isolation, stored shapes, and paid-mode deselection are preserved.

## Verification evidence

Environment: Windows, Node `22.19.0`, npm `11.14.1`; installed dependencies and existing Chromium project.
This is working-tree verification, not the final Phase 8 clean-checkout/install release gate.

| Check                                            | Result                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Initial new cockpit regressions against baseline | Expected failure: 8 failed, 14 passed; reproduced optimistic fallback and hidden overdraft |
| `npm run check`                                  | PASS: 0 errors, 0 warnings                                                                 |
| `npm run test:unit`                              | PASS: 143 tests across 13 files                                                            |
| Final `npm run lint`                             | PASS: Prettier and ESLint                                                                  |
| Production build through `npm run test:e2e`      | PASS: static output generated                                                              |
| Final production browser suite                   | PASS: 57 tests via `node scripts/run-e2e.mjs`, reusing the latest production build         |
| Warning/focus viewport coverage                  | 1280 × 800, 390 × 844, 390 × 400; breakpoint resize and saved-draft reload                 |
| Actual MacBook/Fold and screen-reader review     | Not run; Anthony's review remains required                                                 |

New coverage retains `$100.00 − $125.00 = −$25.00` after another opening is cleared or invalid,
checks all paid modes before Stand Up, structural failures before filtering, negative partial results,
source-action keyboard focus and dock clearance, stable announcements, warning-state Axe scans,
and a legacy draft with a deliberately misleading stored final value. Existing canonical `$324.80`,
money/threshold, backup/restore rollback, audit, and later-session regressions remain in the suites.

Local completion artifacts (these directories remain ignored):
[report](reports/2026-10-04-2336-phase-8-slice-a.md),
[summary](summaries/2026-10-04-2336-phase-8-slice-a.md), and
[walkthrough](walkthroughs/2026-10-04-2336-phase-8-slice-a.md).
The evidence above is retained here so another checkout does not depend on those local files.

## Anthony's Slice A review

Status: **pending; no user acceptance claimed**. Use fabricated payments.

1. On desktop and the Fold, choose each paid mode without a source. Confirm the warning catches
   attention before a simulated external payment, including Custom before typing its amount.
2. Invoke a card and source-summary warning action. Confirm the intended control receives focus and
   stays clear of the sticky dock; ordinary mode selection should preserve focus.
3. Enter Checking `$100.00`, Custom `$125.00`, and choose Checking. Create a second paid row using
   Savings, then clear Savings' opening. Checking must retain `-$25.00` and its overdraft warning.
4. Save and reopen an incomplete draft. Inspect Archive replay, then resume it and change the source.
   Confirm excluded work is obvious, source changes apply once, and notes/amounts survive resizing.
5. Press the active paid mode again. Confirm returning to No payment and clearing source/custom amount
   still feels deliberate. Re-selecting a paid mode must immediately restore the missing-source warning.
6. Inspect partial negative/zero and overpayment states, and invalid date/optional statement input.
   Judge whether the warning language is clear without implying Stashy observes bank payments.

Record candidate revision, device/Brave version, CSS viewport, reproduction, displayed balances,
and acceptance or required changes. Do not mark Phase 8 complete from Slice A acceptance.

## Outstanding Phase 8 work

| Slice            | Remaining work                                                                                                  | Status                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| B                | Unsaved/pending/invalid-work protection and safe lifecycle transitions                                          | Open release blocker                               |
| C                | One writable tab, view-only additional tabs, safe handoff and restore interaction                               | Open release blocker                               |
| D                | Broader keyboard, focus, contrast, motion, dialogs, and accessibility verification                              | Open                                               |
| E                | Compact bounded balances, narrow-screen accordion, actual MacBook/Fold/keyboard measurements                    | Open; large account-count dock obstruction remains |
| F                | Offline readiness, remaining route states, recovery/setup documentation, release identity and Pages preparation | Open                                               |
| Final acceptance | Clean install, full device/release gates, Anthony's Sheet-replacement decision                                  | Pending                                            |

These are planned remaining tasks, not accepted harmless defects. Full requirements remain in the
[Phase 8 plan](PHASE_8_IMPLEMENTATION_PLAN.md#10-execution-sequence-and-review-loops) and
[roadmap](MVP_ROADMAP.md#phase-8--responsive-ux-accessibility-and-release-hardening).
