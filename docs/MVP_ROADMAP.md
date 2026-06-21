# Stashy MVP Roadmap (MS-01)

## Table of Contents

- [Stashy MVP Roadmap (MS-01)](#stashy-mvp-roadmap-ms-01)
  - [Table of Contents](#table-of-contents)
  - [Purpose](#purpose)
  - [MS-01 Outcome](#ms-01-outcome)
  - [Guiding Priorities](#guiding-priorities)
  - [Scope Boundaries](#scope-boundaries)
  - [Proposed Decisions for Roadmap Review](#proposed-decisions-for-roadmap-review)
  - [Delivery and Test Strategy](#delivery-and-test-strategy)
    - [Test Ownership](#test-ownership)
    - [Standard Quality Gate](#standard-quality-gate)
    - [Canonical Acceptance Scenario](#canonical-acceptance-scenario)
  - [Phase 0 — Product Contract and Engineering Foundation](#phase-0--product-contract-and-engineering-foundation)
    - [Objective](#objective)
    - [Development Goals](#development-goals)
    - [Codex Test Instructions](#codex-test-instructions)
    - [Anthony Test Instructions](#anthony-test-instructions)
    - [Exit Criteria](#exit-criteria)
  - [Phase 1 — Exact Money and Domain Model](#phase-1--exact-money-and-domain-model)
    - [Objective](#objective-1)
    - [Development Goals](#development-goals-1)
    - [Codex Test Instructions](#codex-test-instructions-1)
    - [Anthony Test Instructions](#anthony-test-instructions-1)
    - [Exit Criteria](#exit-criteria-1)
  - [Phase 2 — Account and App Configuration](#phase-2--account-and-app-configuration)
    - [Objective](#objective-2)
    - [Development Goals](#development-goals-2)
    - [Codex Test Instructions](#codex-test-instructions-2)
    - [Anthony Test Instructions](#anthony-test-instructions-2)
    - [Exit Criteria](#exit-criteria-2)
  - [Phase 3 — Sit-Down Cockpit](#phase-3--sit-down-cockpit)
    - [Objective](#objective-3)
    - [Development Goals](#development-goals-3)
    - [Codex Test Instructions](#codex-test-instructions-3)
    - [Anthony Test Instructions](#anthony-test-instructions-3)
    - [Exit Criteria](#exit-criteria-3)
  - [Phase 4 — Local Persistence, Drafts, and Stand Up](#phase-4--local-persistence-drafts-and-stand-up)
    - [Objective](#objective-4)
    - [Development Goals](#development-goals-4)
    - [Codex Test Instructions](#codex-test-instructions-4)
    - [Anthony Test Instructions](#anthony-test-instructions-4)
    - [Exit Criteria](#exit-criteria-4)
  - [Phase 5 — Archive, Session Replay, and Editing](#phase-5--archive-session-replay-and-editing)
    - [Objective](#objective-5)
    - [Development Goals](#development-goals-5)
    - [Codex Test Instructions](#codex-test-instructions-5)
    - [Anthony Test Instructions](#anthony-test-instructions-5)
    - [Exit Criteria](#exit-criteria-5)
  - [Phase 6 — Whiteboard and Account History](#phase-6--whiteboard-and-account-history)
    - [Objective](#objective-6)
    - [Development Goals](#development-goals-6)
    - [Codex Test Instructions](#codex-test-instructions-6)
    - [Anthony Test Instructions](#anthony-test-instructions-6)
    - [Exit Criteria](#exit-criteria-6)
  - [Phase 7 — Data Export, Import, and Recovery](#phase-7--data-export-import-and-recovery)
    - [Objective](#objective-7)
    - [Development Goals](#development-goals-7)
    - [Codex Test Instructions](#codex-test-instructions-7)
    - [Anthony Test Instructions](#anthony-test-instructions-7)
    - [Exit Criteria](#exit-criteria-7)
  - [Phase 8 — Responsive UX, Accessibility, and Release Hardening](#phase-8--responsive-ux-accessibility-and-release-hardening)
    - [Objective](#objective-8)
    - [Development Goals](#development-goals-8)
    - [Codex Test Instructions](#codex-test-instructions-8)
    - [Anthony Test Instructions](#anthony-test-instructions-8)
    - [Exit Criteria](#exit-criteria-8)
  - [MS-01 Final Acceptance Test](#ms-01-final-acceptance-test)
    - [Codex Preparation](#codex-preparation)
    - [Anthony End-to-End Exercise](#anthony-end-to-end-exercise)
    - [Acceptance Rule](#acceptance-rule)
  - [Definition of Done](#definition-of-done)
  - [Post-MVP Parking Lot](#post-mvp-parking-lot)
  - [Roadmap Review Checklist](#roadmap-review-checklist)

## Purpose

This roadmap converts the product intent in [DESIGN_DOC.md](./DESIGN_DOC.md) into an ordered development exercise for Milestone 1 (MS-01).

It is organized around demonstrable product slices rather than disconnected technical layers. Each phase should leave Stashy in a testable state, and no phase is complete until its exit criteria have been met.

The roadmap intentionally separates:

- Tests Codex can execute and report on.
- Product and workflow tests Anthony must perform as the user and ideator.
- Decisions that should be reviewed before implementation makes them expensive to change.

## MS-01 Outcome

MS-01 is complete when Anthony can replace the current Google Sheet with Stashy for a real payment sit-down.

The finished MVP must allow the user to:

1. Configure asset and liability accounts.
2. Begin a dated sit-down.
3. Enter user-given opening balances.
4. Plan one payment per liability from one source asset.
5. Use full-balance, statement-balance, or custom payment modes.
6. See remaining liability balances and projected asset balances update immediately.
7. Receive clear but non-blocking warnings about dangerous or unusual money states.
8. Save a draft or stand up and save the session.
9. Reopen, review, and edit a saved session with an audit trail.
10. Review latest account state and balance history.
11. Export and restore all local data.
12. Complete the workflow comfortably on desktop and adequately on mobile.

## Guiding Priorities

Every phase should preserve the priority order established in the design:

1. Prevent overdrafts.
2. Make data entry fast.
3. Keep clean historical records.
4. Provide useful analysis.

When two implementation choices compete, the earlier priority wins. For example, immediate and trustworthy asset projections matter more than a sophisticated chart.

Additional engineering principles:

- Use exact decimal arithmetic for all money calculations. Never use floating-point arithmetic as the source of truth.
- Treat all balances as user-given snapshots.
- Apply planned payments to projected asset balances immediately.
- Warn about messy records without preventing the user from saving them.
- Keep the model ID-based and reasonably flat.
- Make IndexedDB the source of truth for MS-01.
- Preserve historical records without trying to recalculate later sessions.
- Favor a focused, tactile workflow over a generic finance dashboard.

## Scope Boundaries

The following are explicitly outside MS-01:

- Bank connections, balance scraping, or transaction imports.
- Initiating or tracking the external status of payments.
- Due dates, reminders, statement dates, APR, minimum payments, or autopay.
- Split payments or multiple payments to the same liability in one session.
- General budgeting or transaction management.
- Multiple users, profiles, or household sharing.
- Encryption, authentication, or an app lock.
- Importing Anthony's historical Google Sheet data.
- Formal payment-intent labels beyond the three payment modes.
- Recalculating later sessions after an older session is edited.
- A generalized accounting ledger.

Any feature that crosses these boundaries should be placed in the parking lot unless it is required to make an existing MS-01 behavior safe or usable.

## Proposed Decisions for Roadmap Review

These details are not fully fixed by the design document. The roadmap uses the following defaults so implementation can remain concrete. They should be approved or changed during roadmap review.

1. **Money storage:** Store monetary values as integer minor units (cents) and format them as decimal currency at the UI boundary.
2. **Currency:** MS-01 supports one app-wide currency, initially USD. Multi-currency behavior is deferred.
3. **Threshold shape:** App defaults and asset overrides use two ordered boundaries: `warningBelow` and `dangerBelow`. At or above the warning boundary is healthy, below it is warning, and below the danger boundary is danger. No threshold means no threshold color.
4. **Import behavior:** Import is a full restore that replaces current local data only after validation, a warning, and explicit confirmation. Merge import is deferred.
5. **Draft meaning:** A draft is an intentionally unfinished session. A stood-up session may still have blank confirmation IDs or notes and remains editable.
6. **Account names in history:** Historical records keep account IDs and display the account's current name, matching the global-rename requirement.
   1. **Anthony's Comment** --> We can create a unique account ID when the account is created. Displaying the correct account name is just a matter of looking up the name attached to the ID. Thus, when the name is changed, you're changing the name in storage at the ID's record rather than having to go back and updating every single record every created.
7. **Same-date sessions:** Multiple sessions may share a sit-down date; creation time and ID keep them distinct.
8. **Audit scope:** Editing a saved session records before-and-after snapshots for changed session, account-record, and payment-record entities. Draft autosaves do not create audit noise.
9. **Initial analysis rule:** The Whiteboard's latest state comes from the latest stood-up session. Drafts do not change the dashboard.
10. **Archive scope:** MS-01 provides a reverse-chronological list and full replay. Advanced search and filtering are not release blockers.

## Delivery and Test Strategy

### Test Ownership

**Codex-owned tests** cover deterministic behavior:

- Type checking, linting, and production builds.
- Unit tests for money, payment, threshold, validation, and migration logic.
- Repository and IndexedDB integration tests.
- ~~Browser tests for critical user paths.~~
- Import/export round trips and invalid-file handling.
- Responsive and accessibility checks that can be automated.

**Anthony-owned tests** cover product truth:

- Whether the workflow matches the real sit-down.
- Whether projected balances are understandable under pressure.
- Whether data entry feels faster and more tactile than the spreadsheet.
- Whether warning colors and messages attract the right amount of attention.
- Whether desktop density and mobile flow feel appropriate.
- Whether archive replay and Whiteboard views answer the intended questions.

User acceptance should use representative or fabricated data until the final private-data trial.

### Standard Quality Gate

Phase 0 will establish the exact scripts, but each later phase should finish with equivalents of:

```powershell
npm run check
npm run lint
npm run test:unit
npm run test:e2e
npm run build
```

If a command is not yet relevant, the phase must state why. A production build, type check, and lint pass are required from Phase 0 onward.

Defects are classified as:

- **Release blocker:** Can lose data, produce an incorrect money result, hide overdraft risk, corrupt history, or prevent the core workflow.
- **Phase blocker:** Breaks the current phase's exit criteria.
- **Follow-up:** Does not compromise MS-01 safety or completion and can be consciously deferred.

### Canonical Acceptance Scenario

The following reusable scenario should be encoded as automated fixtures and repeated manually where useful:

**Accounts**

- Asset: Checking, opening balance `$1,000.10`, warning below `$400.00`, danger below `$100.00`.
- Asset: Savings, opening balance `$500.00`, no thresholds.
- Liability: Card A, account balance `$600.30`, statement balance `$400.20`.
- Liability: Card B, account balance `$250.00`, statement balance `$100.00`.
- Liability: Card C, account balance `$25.00`, statement balance `$10.00`.

**Payments**

- Card A: statement-balance payment of `$400.20` from Checking.
- Card B: full-balance payment of `$250.00` from Checking.
- Card C: custom payment of `$25.10` from Checking.

**Expected results**

- Checking projected final balance is `$324.80`.
- Checking is in the warning threshold state.
- Card A remaining account balance is `$200.10`.
- Card A remaining statement balance is `$0.00`.
- Card B remaining account and statement balances are `$0.00`.
- Card C remaining account balance is `-$0.10`.
- Card C remaining statement balance is `-$15.10`.
- Card C displays non-blocking overpayment/negative-balance warnings.
- Saving remains unaffected.

A separate penny-precision test must confirm that calculations such as `$100.10 - $0.10 - $0.20` resolve exactly to `$99.80`.

## Phase 0 — Product Contract and Engineering Foundation

### Objective

Turn the design into an executable product contract and establish a safe development baseline for the SvelteKit application.

### Development Goals

- Confirm or revise the proposed decisions in this roadmap.
- Define the primary route and navigation structure:
  - Home.
  - Sit Down.
  - Archive.
  - Whiteboard.
  - Configuration / Accounts.
  - Configuration / Save Data and Import Data.
- Establish the application shell, responsive layout foundation, error boundary, and empty states.
- Confirm static/local deployment assumptions for IndexedDB usage.
- Add a unit-test runner and browser end-to-end test runner.
- Add scripts for unit tests, end-to-end tests, and CI-style verification.
- Add reusable test fixtures and a test database reset mechanism.
- Define naming conventions for domain entities, storage repositories, services, and UI components.
- Record schema version `1` and the migration convention before persistent data exists.
- Add a lightweight decision log or architecture notes for choices that affect stored data.

### Codex Test Instructions

1. Run the standard quality gate.
2. Start the development server and visit every top-level route.
3. Verify that direct navigation and browser refresh work for each route.
4. Run one sample unit test and one sample browser test to prove both harnesses work.
5. Test a narrow desktop viewport and a representative mobile viewport for horizontal overflow in the app shell.
6. Confirm that no production code assumes network access or a server-side database.

### Anthony Test Instructions

1. Review the proposed decisions in this roadmap.
2. Review the route names and navigation language.
3. Confirm that "Sit Down," "Check Archive," "Visit Whiteboard," and configuration are immediately understandable.
4. Review rough desktop and mobile shells before visual polish begins.
5. Reject any navigation or terminology that feels like generic accounting software.

### Exit Criteria

- Product decisions needed for stored-data design are approved.
- The app has a navigable shell.
- Automated test infrastructure is operational.
- The standard quality gate passes.
- No unresolved decision blocks the domain model.

## Phase 1 — Exact Money and Domain Model

### Objective

Build the trustworthy calculation and data foundation that every later screen will use.

### Development Goals

- Define typed models for:
  - App settings.
  - Account.
  - Session.
  - Payment record.
  - Account record.
  - Audit entry.
- Use stable IDs and created/edited timestamps.
- Represent all money using exact minor-unit values.
- Create parsing and formatting utilities that:
  - Accept normal decimal currency input.
  - Preserve pennies exactly.
  - Reject malformed values clearly.
  - Avoid silently rounding unexpected precision.
- Implement pure domain calculations for:
  - Full-balance payment.
  - Statement-balance payment.
  - Custom payment.
  - Remaining account balance.
  - Remaining statement balance.
  - Projected final asset balance across multiple payments.
  - Asset threshold state.
- Implement non-blocking validation results for:
  - Negative and zero projected asset balances.
  - Liability overpayment.
  - Negative remaining account or statement balance.
  - Missing source asset.
  - Invalid or missing required balances.
  - Duplicate payment records for the same liability in one session.
- Keep warnings separate from hard data-format errors.
- Define selectors that produce historical account datapoints without building a generalized ledger.

### Codex Test Instructions

1. Unit-test all payment modes with whole-dollar and penny values.
2. Run the penny-precision test from the canonical scenario.
3. Verify that payment mode changes recalculate from the appropriate starting balance.
4. Verify that multiple liability payments subtract from the correct source assets.
5. Verify that one liability cannot produce two payment records in the same session.
6. Verify that negative, zero, and overpayment states return warnings rather than save-blocking errors.
7. Verify threshold boundaries exactly at, one cent above, and one cent below each configured boundary.
8. Verify account-history selectors use saved snapshots and do not infer missing transactions.
9. Run the standard quality gate.

### Anthony Test Instructions

1. Review the field names and model examples for plain-language accuracy.
2. Confirm that "account balance," "statement balance," and both remaining balances mean what they do in the real workflow.
3. Review warning messages for financial usefulness without legalistic or alarmist wording.
4. Confirm that the threshold behavior matches the mental model used during a sit-down.

### Exit Criteria

- All monetary behavior is covered by deterministic unit tests.
- No core calculation uses floating-point money as its source of truth.
- The canonical scenario produces the expected results.
- Domain models support every record required by the design document.
- Warning behavior is approved before cockpit implementation.

## Phase 2 — Account and App Configuration

### Objective

Allow the user to establish the accounts and threshold settings required to conduct a sit-down.

### Development Goals

- Build account list and account editor views.
- Support only two account types: asset and liability.
- Support account creation, rename, archive, unarchive, and threshold configuration.
- Prevent accidental destructive deletion; archiving is the normal retirement path.
- Hide archived accounts from new sit-downs while keeping them resolvable in history.
- Add app-level default asset thresholds.
- Allow each asset to inherit defaults, override them, or use no thresholds.
- Validate threshold ordering and money inputs.
- Establish stable, deliberate account ordering for sit-down entry.
- Add useful first-run and no-account empty states.
- Persist configuration through the repository abstraction, even if the complete session workflow is not present yet.

### Codex Test Instructions

1. Create asset and liability accounts and verify they persist after reload.
2. Rename an account and verify references resolve to the new name.
3. Archive an account and verify it disappears from active-account selectors.
4. Verify archived accounts remain available to historical-record resolution.
5. Test inherited, overridden, and disabled threshold settings.
6. Verify invalid threshold ordering is explained and cannot be stored.
7. Verify liability accounts do not expose asset-threshold controls.
8. Run keyboard navigation and automated accessibility checks on all forms.
9. Run the standard quality gate.

### Anthony Test Instructions

1. Configure a realistic set of current accounts.
2. Judge whether setup is appropriately small and fast.
3. Rename and archive test accounts and confirm the behavior feels safe.
4. Configure Checking thresholds and confirm the language is intuitive without reading documentation.
5. Review account ordering and identify whether manual reordering is required for MS-01. If it is required, add it before Phase 2 closes.

### Exit Criteria

- The user can configure every account needed for a sit-down.
- Account and app settings survive reload.
- Archived accounts are absent from new work but preserved for history.
- Threshold inheritance and overrides are understandable and tested.

## Phase 3 — Sit-Down Cockpit

### Objective

Deliver the core MS-01 experience: a fast, tactile payment-planning workspace with immediate overdraft visibility.

### Development Goals

- Build a new-session flow with a user-editable sit-down date.
- Show active asset accounts with editable opening balances and live projected final balances.
- Show active liability accounts with:
  - Starting account balance.
  - Starting statement balance.
  - Source asset selector.
  - Full-balance, statement-balance, and custom payment modes.
  - Payment amount.
  - Remaining account balance.
  - Remaining statement balance.
  - Confirmation ID.
  - Notes.
- Make each liability row or card a focused payment interaction rather than a spreadsheet clone.
- Recalculate all affected balances immediately after relevant input.
- Make pending payments reduce the source asset's projected balance immediately.
- Apply healthy, warning, and danger threshold visuals to projected asset balances.
- Display clear non-blocking warnings for:
  - Projected asset balance below zero.
  - Projected asset balance equal to zero.
  - Liability overpayment.
  - Negative remaining balances.
  - Other messy but saveable states defined in Phase 1.
- Ensure changing the source asset moves the payment projection from the old asset to the new one exactly once.
- Preserve unsaved in-page state while navigating among controls.
- Provide explicit Draft and Stand Up actions, even before their persistence behavior is completed in Phase 4.
- Protect against accidental double submission.

### Codex Test Instructions

1. Execute the canonical acceptance scenario in a browser test.
2. Enter values one field at a time and verify projections update without requiring a submit action.
3. Switch a payment among all three modes and verify amount and remaining balances.
4. Change a source asset and verify both old and new asset projections.
5. Create negative, zero, and overpayment states and verify visible non-blocking warnings.
6. Enter and edit confirmation IDs and notes without changing money calculations.
7. Verify every form control has an accessible name and usable keyboard focus.
8. Verify rapid edits do not create stale or duplicated calculations.
9. Test at desktop and mobile viewport widths for clipped inputs or unreachable actions.
10. Run the standard quality gate.

### Anthony Test Instructions

1. Recreate a representative sit-down using fabricated balances.
2. Complete the flow without referring to the design document.
3. Compare entry speed and cognitive effort with the Google Sheet.
4. Intentionally push Checking into warning, danger, zero, and negative states.
5. Confirm the projected asset balance is the most visually useful number during payment decisions.
6. Confirm warnings attract attention without blocking legitimate messiness.
7. Evaluate whether liability controls feel tactile rather than like spreadsheet cells.
8. Repeat the flow on a phone-sized viewport and identify any step that feels cramped, confusing, or too dense.

### Exit Criteria

- A complete sit-down can be entered in memory.
- All projected balances and remaining balances are exact and immediate.
- Overdraft risk is difficult to miss.
- The user can complete the workflow without fighting the interface.
- Anthony approves the core interaction before persistence makes it durable.

## Phase 4 — Local Persistence, Drafts, and Stand Up

### Objective

Make the core workflow durable in IndexedDB and define the lifecycle of a sit-down.

### Phase 3 Persistence Handoff

Phase 3 already introduced IndexedDB version 2 and the minimum normalized draft workflow needed for
carry-forward user testing. It added `sessions`, `accountRecords`, and `paymentRecords` stores with
session/account relationship indexes; an atomic explicit Save Draft upsert; stable session and child
record IDs; strict stored-record validation; and automatic resume of the most recently updated draft.
Draft saves preserve creation timestamps, update edit timestamps, and create no audit entries. Stand
Up currently validates completeness but deliberately leaves the session as a draft.

Phase 4 should extend this implementation rather than create a second persistence path. It still owns
persisting `isDraft: false`, final stood-up account/payment snapshots, clear lifecycle status and
completion UX, interrupted-write and recoverable-error behavior, migration tests beyond the Phase 3
version-1-to-version-2 coverage, and any additional atomicity or indexes needed by archive and history
work. Phase 4 must also decide whether explicit saving remains the only draft policy or is combined
with visible autosave.

### Development Goals

- Implement a versioned IndexedDB database and repository layer.
- Store app settings, accounts, sessions, account records, payment records, and audit entries separately with ID-based relationships.
- Add appropriate indexes for session date, session ID, account ID, and related-record lookups.
- Save and reopen drafts.
- Implement Stand Up as the explicit action that saves a completed session snapshot.
- Permit stood-up sessions with blank confirmation IDs or notes.
- Distinguish clearly between draft and stood-up state.
- Store both opening and final account snapshots.
- Ensure draft saving and standing up are atomic enough to avoid partial session records.
- Add protection for interrupted writes and surface recoverable storage errors.
- Define schema migration behavior and test upgrading from the initial version.
- Decide and implement whether drafts autosave, save only on command, or combine both with a visible status indicator.

### Codex Test Instructions

1. Save a partial draft, reload the application, and resume it with all values intact.
2. Stand up the canonical session, reload, and verify every account and payment record.
3. Verify blank confirmation IDs do not force a stood-up session to remain a draft.
4. Verify opening and final balances match the exact domain calculations.
5. Simulate a failed write and confirm the UI reports failure rather than pretending the session was saved.
6. Verify repeated clicks do not create duplicate sessions or payment records.
7. Verify draft data does not affect latest-state analysis selectors.
8. Run repository integration tests against a clean and an upgraded database.
9. Run the standard quality gate.

### Anthony Test Instructions

1. Start a session, enter part of the data, save it as a draft, close the tab, and resume it.
2. Stand up a session with at least one blank confirmation ID.
3. Reopen the app and confirm that the saved results match what you remember entering.
4. Review the wording and emotional feel of the Stand Up completion state.
5. Confirm it is always obvious whether work is unsaved, saved as a draft, or stood up.

### Exit Criteria

- Draft and stood-up sessions survive reload and browser restart.
- Session writes do not produce partial related records under tested failure conditions.
- Saved money values reproduce the exact on-screen calculations.
- Storage state is visible and understandable to the user.

## Phase 5 — Archive, Session Replay, and Editing

### Objective

Provide trustworthy historical review and safe correction of saved sessions.

### Development Goals

- Build a reverse-chronological archive list.
- Show enough summary information to distinguish sessions without exposing unnecessary clutter.
- Open any archived session in full view/replay mode.
- Provide an explicit Edit action that reuses the sit-down interface.
- Preserve session IDs and record relationships while editing.
- Create audit entries for changes to stood-up sessions.
- Keep before-and-after values sufficient for future audit presentation.
- Prevent edits to older sessions from recalculating newer sessions.
- Resolve account names dynamically so global renames appear in old sessions.
- Continue to display archived accounts in historical sessions.
- Allow later entry or correction of confirmation IDs and notes.

### Codex Test Instructions

1. Create sessions on several dates and verify newest-first archive ordering.
2. Open each session and compare the replay to its stored account and payment records.
3. Edit a confirmation ID and verify an audit entry contains before and after values.
4. Edit a payment amount and verify the session's own final balances update.
5. Verify editing an older session does not alter any later session.
6. Rename and archive an account, then verify old sessions display the current name and remain readable.
7. Verify a draft is clearly marked and cannot be mistaken for a stood-up session.
8. Verify direct navigation to a missing session shows a useful not-found state.
9. Run the standard quality gate.

### Anthony Test Instructions

1. Create at least three sessions, including one draft.
2. Find and replay each session without relying on memorized creation order.
3. Add a missing confirmation ID to a stood-up session.
4. Correct an old payment and confirm later sessions remain untouched.
5. Decide whether the archive summary shows enough information for MS-01.
6. Confirm replay mode communicates what happened without looking editable until Edit is chosen.

### Exit Criteria

- Every saved session can be found and replayed.
- Stood-up sessions can be corrected without rewriting later history.
- Every tested correction produces an audit entry.
- Account rename and archive behavior remains historically coherent.

## Phase 6 — Whiteboard and Account History

### Objective

Answer the two MS-01 analysis questions: "Where am I now?" and "How has this account changed over time?"

### Development Goals

- Build a Whiteboard summary based on the latest stood-up session.
- Display latest known asset and liability state with an explicit as-of date.
- Exclude drafts from the latest-state summary.
- Allow selection of an asset or liability account.
- Build a balance-over-time graph for the selected account.
- Show user-defined asset threshold lines where applicable.
- Add a tabular history below the graph.
- Make graph points and table rows expose relevant details:
  - Sit-down date.
  - Opening and final balances.
  - Statement balances when applicable.
  - Payment amount and mode.
  - Source asset.
  - Confirmation ID.
  - Notes.
- Link a datapoint back to its source session.
- Handle sparse histories, archived accounts, same-date sessions, and empty state cleanly.
- Ensure graph visuals never obscure exact values available in the table.

### Codex Test Instructions

1. Create a multi-session fixture and verify the Whiteboard uses the latest stood-up session.
2. Verify a newer draft does not replace the stood-up latest state.
3. Compare every plotted point with its corresponding table and stored record.
4. Verify asset and liability histories use the correct balance fields.
5. Verify threshold lines match account settings.
6. Open a datapoint detail and follow its link to the correct session.
7. Test accounts with zero, one, and many datapoints.
8. Test same-date sessions and archived accounts.
9. Verify chart information remains available through accessible text or the table.
10. Run the standard quality gate.

### Anthony Test Instructions

1. Review the Whiteboard after creating several representative sessions.
2. Answer, without opening the archive: "What does my latest financial snapshot look like?"
3. Select each account and judge whether its history tells the expected story.
4. Compare graph and table usefulness; identify any detail that is noise rather than insight.
5. Open a datapoint and navigate back to its session.
6. Confirm the Whiteboard is useful but does not compete with the Sit Down workflow for importance.

### Exit Criteria

- The Whiteboard clearly states the latest known stood-up state and its date.
- Every graph point is traceable to exact tabular data and a source session.
- Account history works for assets, liabilities, and archived accounts.
- Anthony confirms the two day-one analysis questions are answered.

## Phase 7 — Data Export, Import, and Recovery

### Objective

Give the user control over local-first data and a tested path to recover it.

### Development Goals

- Define a versioned JSON export envelope containing:
  - Export format and schema version.
  - Export timestamp.
  - App metadata.
  - App settings.
  - Accounts.
  - Sessions.
  - Account records.
  - Payment records.
  - Audit entries.
- Export all data without silently omitting drafts, archived accounts, or audit history.
- Validate imports before changing local data.
- Show a readable import summary and destructive replacement warning.
- Require explicit confirmation before replacing current data.
- Keep existing data unchanged when validation fails or import is canceled.
- Restore data in a transaction or equivalent all-or-nothing process.
- Reject unsupported future schema versions safely.
- Provide a clear post-import success state and recommend reload only if technically necessary.
- Document the backup and restore procedure in user-facing language.

### Codex Test Instructions

1. Export a populated database containing active accounts, archived accounts, drafts, stood-up sessions, and audit entries.
2. Clear the test database, import the file, and compare every exported collection and relationship.
3. Re-run the canonical calculations from restored records.
4. Attempt imports with malformed JSON, missing required collections, broken IDs, invalid money values, and unsupported versions.
5. Verify every failed or canceled import leaves existing data unchanged.
6. Verify a successful import replaces old data rather than merging it.
7. Verify export filenames are meaningful and include a date.
8. Run the standard quality gate.

### Anthony Test Instructions

1. Create a backup from a realistic local dataset.
2. Store the file somewhere outside the browser's download folder.
3. Add a clearly disposable session after the backup.
4. Restore the backup and confirm the disposable session is gone while backed-up data is intact.
5. Review the replacement warning and import summary for clarity.
6. Confirm the process feels trustworthy enough to use before browser cleanup or moving machines.

### Exit Criteria

- Export/import round trips preserve all MS-01 data.
- Invalid imports cannot partially replace or corrupt current data.
- The user understands that import is a full restore, not a merge.
- Backup and recovery have been manually demonstrated.

## Phase 8 — Responsive UX, Accessibility, and Release Hardening

### Objective

Turn the complete feature set into a dependable MVP that is comfortable on desktop, sane on mobile, and ready for real use.

### Development Goals

- Refine desktop information density while preserving the cockpit feel.
- Convert liability rows into an appropriate stacked or step-oriented mobile presentation.
- Keep projected asset balances and warning state visible while editing payments on small screens.
- Add polished loading, empty, success, warning, error, and not-found states.
- Verify keyboard navigation, focus management, labels, contrast, and screen-reader structure.
- Respect reduced-motion preferences.
- Improve touch targets and numeric input behavior on mobile.
- Add leave-page protection when unsaved work would be lost.
- Verify behavior after browser refresh, tab closure, and application restart.
- Review dependency and bundle choices; remove accidental complexity.
- Write concise setup, run, test, backup, restore, and MS-01 limitation documentation.
- Perform a clean production build and preview test.
- Freeze schema version `1` only after restore testing succeeds.

### Codex Test Instructions

1. Run the full standard quality gate from a clean checkout/install state.
2. Run the complete end-to-end suite at desktop and mobile viewports.
3. Run automated accessibility checks on every top-level route and core dialog.
4. Complete the canonical scenario using keyboard-only interaction.
5. Verify there is no accidental horizontal page scrolling at supported widths.
6. Test unsaved-work protection and recovery paths.
7. Preview the production build and repeat the core sit-down, archive, Whiteboard, export, and import smoke tests.
8. Verify no network request is required for core app functionality after the app is loaded.
9. Record any accepted non-blocking defects in a visible follow-up list.

### Anthony Test Instructions

1. Perform one full fabricated sit-down on desktop without developer assistance.
2. Perform a second full sit-down on a phone-sized device or viewport.
3. Deliberately make and recover from input mistakes.
4. Save a draft, resume it, stand up, replay it, edit it, inspect the audit result, and view account history.
5. Export the data and complete a restore.
6. Judge the experience against the product's emotional goal: the sit-down should feel controlled and satisfying even when the balances are unpleasant.
7. Identify any issue that would make you return to the Google Sheet.

### Exit Criteria

- No release blockers remain.
- All automated tests and production build checks pass.
- Desktop is first-class and mobile is usable without spreadsheet-like compression.
- Anthony can complete the full workflow without assistance.
- Backup and restore have passed both automated and manual tests.
- Known follow-ups are documented and consciously deferred.

## MS-01 Final Acceptance Test

This is the release-candidate exercise. It should be run only after all phase exit criteria are met.

### Codex Preparation

1. Start from a clean test database.
2. Run the full automated quality gate and save the results.
3. Provide a production-preview build.
4. Prepare a short issue template for Anthony to record:
   - Blocker.
   - Confusing.
   - Slow or annoying.
   - Visually wrong.
   - Nice-to-have.

### Anthony End-to-End Exercise

1. Configure realistic asset and liability accounts.
2. Set app defaults and at least one per-account threshold override.
3. Begin a dated sit-down.
4. Enter all opening asset balances.
5. Enter all liability account and statement balances.
6. Use each payment mode at least once.
7. Change a payment's source asset after entering it.
8. Trigger warning, danger, zero, negative, and overpayment states.
9. Add confirmation IDs and notes to some, but not all, payments.
10. Save the session as a draft and close the app.
11. Reopen and resume the draft.
12. Stand up the session.
13. Confirm that the archive replay exactly matches the work completed.
14. Add a missing confirmation ID after standing up.
15. Confirm an audit entry is created.
16. Create a second stood-up session with new user-given balances.
17. Edit the first session and confirm the second session does not change.
18. Use the Whiteboard to inspect latest state and account histories.
19. Export all data.
20. Make a disposable change, restore the export, and confirm the disposable change is removed.
21. Repeat the core payment-entry flow on mobile.
22. Decide whether Stashy can replace the Google Sheet for the next real sit-down.

### Acceptance Rule

MS-01 passes only if:

- Anthony answers "yes" to replacing the Sheet for a real sit-down.
- No incorrect money calculation is observed.
- No overdraft warning is missed because of presentation or stale calculation.
- No data is lost during tested save, edit, export, or restore operations.
- Any remaining defects are explicitly accepted as non-blocking.

## Definition of Done

Stashy MS-01 is done when all of the following are true:

- The core sit-down workflow is complete and approved.
- Exact decimal behavior is proven by automated tests.
- Asset projections update immediately and accurately.
- Threshold and messy-state warnings are visible but non-blocking.
- Accounts, drafts, sessions, history, and audit entries persist in IndexedDB.
- Archive replay and editing work without recalculating later sessions.
- Whiteboard latest-state and balance-history views answer their two intended questions.
- A complete export can restore a complete local database safely.
- Desktop, mobile, keyboard, and basic accessibility acceptance tests pass.
- Documentation explains local storage, backup, restore, and MS-01 limitations.
- The final acceptance exercise passes.

MS-01 is not done merely because all screens exist. It is done when the application can safely replace the spreadsheet for the real workflow.

## Post-MVP Parking Lot

The following ideas should remain visible without entering MS-01 by accident:

- Bank integrations or transaction import.
- Historical Google Sheet import.
- Payment statuses.
- Due dates, reminders, minimum payments, APR, or autopay.
- Formal payment-intent labels.
- Split or repeated payments.
- Advanced archive search and filtering.
- Additional charts and financial metrics.
- Multi-currency support.
- Multiple users or profiles.
- Encryption or application locks.
- Cloud sync.
- General budgeting.
- A richer user-facing audit history.
- Additional account classifications, icons, institutions, or metadata.

## Roadmap Review Checklist

During critique, review this document in the following order:

1. Does the MS-01 outcome fully replace the current Sheet workflow?
2. Are the proposed decisions acceptable, especially money storage, threshold behavior, draft semantics, and import replacement?
3. Is any phase ordered too early or too late?
4. Does each phase produce something meaningful enough to test?
5. Are Anthony-owned tests concrete enough to expose a bad product decision?
6. Are any Codex-owned tests missing from money, persistence, or recovery risk areas?
7. Has any out-of-scope feature slipped into the release path?
8. Is the final acceptance rule strict enough to justify using Stashy with real financial data?

Approval of this roadmap means approval of its sequence and test gates, not a freeze on interface details. Interaction design may evolve during implementation as long as it continues to satisfy the design document and phase exit criteria.
