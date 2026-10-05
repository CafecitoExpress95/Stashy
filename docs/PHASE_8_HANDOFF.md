# Phase 8 planning hand-off

Prepared October 4, 2026, for a higher-reasoning model to take over planning and
outlining. User-named target: **Phase 8 — Responsive UX, Accessibility, and Release
Hardening**. This is an assessment and documentation task, not implementation or
a declaration that prior phases have passed user acceptance.

## Assessment

Stashy has the main MS-01 capabilities implemented and a passing automated baseline.
Phase 8 should focus on protecting unsaved work, making the existing cockpit
comfortable across devices, completing accessibility coverage, and proving release
readiness. There is no evidence here that a new domain model, persistence layer,
or wholesale redesign is needed.

Anthony reported an actual overdraft during a sit-down after forgetting to select
a payment source, with no visual warning and an emergency transfer required.
**Treat this as the first release-blocker investigation.** Source inspection shows
missing-source warnings are filtered out of the card's financial warning list,
the specific source-field error waits until Stand Up is attempted, and unresolved
payments do not reduce asset projections. A complete-looking asset balance can
therefore be misleading while a paid row has no source.

A separate consequential source finding is that draft work has an 800 ms autosave
delay and can remain unsaved after invalid input or a failed write, but navigation
and unload protection currently apply only to historical corrections. Prioritize
reproducing and closing that gap before cosmetic work.

Anthony confirms Whiteboard and backup/restore manual trials were OK, with no
issues. That closes the previously unconfirmed trial question, but the reported
overdraft prevents interpreting those successes or a green suite as readiness to
replace the Sheet.

## Authority and scope

- [Repository guide](../AGENTS.md): exact cents, manual snapshots, immediate
  projections, warnings without blocking valid messy records, history isolation,
  IndexedDB, and desktop first with usable mobile.
- [Design](DESIGN_DOC.md): product intent, tactile hybrid cockpit, satisfying and
  controlled sit-down, current-name historical references, and analysis subordinate
  to entry and overdraft prevention.
- [Roadmap](MVP_ROADMAP.md#phase-8--responsive-ux-accessibility-and-release-hardening):
  Phase 8 requirements, gates, Anthony's trials, and final acceptance exercise.
- [Architecture](ARCHITECTURE.md): approved stored-data decisions and lifecycle
  conventions. Read local ancestor guides before changing any target file.
- [Existing product answers](../QUESTIONS.md): specificity of purpose and general
  entry flow are established. Avoid reopening already-settled finance scope.

Keep budgeting, bank integration, payment statuses, reminders, encryption, cloud
sync, split payments, and a generalized ledger out of MS-01. A richer user-facing
audit browser remains deferred; plan a practical way to verify audit data during
acceptance without making that a new product feature.

## Inspected project state

Baseline commit: `5d42e42` (`Fixed the import issue???`). Initial Git status showed
no changes. Git emitted permission warnings reading the global ignore file, but
repository inspection and checks completed. Only this document is added by the
assessment; no runtime, test, dependency, or authoritative requirement changes.

| Area          | Current implementation                                                                                                     | Planning implication                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Foundation    | Svelte 5, SvelteKit, TypeScript, Vite, static adapter, prerendered trailing-slash routes                                   | Keep static deployment and route orchestration boundaries.                                     |
| Money/domain  | Branded safe integer cents, exact text parsing using BigInt, checked arithmetic, pure calculations and selectors           | Reuse the existing domain API; JavaScript numbers holding exact integer cents are intentional. |
| Accounts      | Create, rename, order, archive/unarchive, inherited/custom/disabled asset thresholds                                       | Polish existing forms and error recovery rather than add account metadata.                     |
| Cockpit       | Focused liability cards, immediate source projections, No payment default, three paid modes, optional statement balance    | Preserve the deliberately revised mode interaction and no-payment behavior.                    |
| Lifecycle     | Serialized atomic saves, draft autosave/manual flush, confirmed Stand Up, durable receipt, new draft                       | Protect transitions around pending, invalid, and failed saves.                                 |
| Archive       | Newest-first summaries, query-ID replay/edit, audited explicit corrections, later-session isolation                        | Expand keyboard/focus/recovery verification without altering history semantics.                |
| Whiteboard    | Latest stood-up snapshot, draft exclusion, assets/liabilities, current threshold lines, exact history table and details    | Keep the table as the accessible exact representation of chart data.                           |
| Recovery      | ZIP-compatible `.stashy` files with manifest and JSON records, validation, review, full atomic replacement                 | Preserve the repaired plain-record structured-clone boundary and rollback behavior.            |
| Responsive UI | 1180 px maximum frame, sticky desktop rail, stacked layouts below 920 px, further stacking below 620 px, mobile asset dock | Existing responsive foundation needs realistic stress testing, not automatic replacement.      |

The latest [Phase 7 repair report](reports/2026-10-03-1735-phase-7-archive-restore.md)
records actual UI round trips, all-six-store replacement, native clone failures,
transaction aborts, clean retry, and preserved nested audits. The prepared archive
uses `$state.raw`; do not reintroduce deep Svelte proxies at IndexedDB writes.
That report explicitly leaves realistic manual recovery and hosting verification
open. The [Phase 6 report](reports/2026-06-22-1827-phase-6-whiteboard-history.md)
likewise leaves product usefulness and device judgment to Anthony.

Historical reports are local and ignored by the repository's current convention.
This hand-off is directly under `docs/` so it is visible to Git and transferable.

## Phase 8 gaps and investigation priorities

### 1. Missing-source and projection trust — highest priority

Anthony's report: “I forgot to select a payment account last time I sat down” and
needed an emergency transfer after overdrawing the target account; “There was no
visual warning to that fact.” The exact input sequence and build at the time are
not established. Do not assert that the UI can know which real bank account paid
an unassigned row; it must communicate that the projection is incomplete.

Concrete inspection evidence:

- [Cockpit adapter](../src/lib/domain/cockpit.ts): `calculatePayment` failures leave
  a payment unresolved; projected asset values fall back to entered opening
  balances when projections are unavailable.
- [Payment calculation](../src/lib/domain/calculations.ts): paid modes without a
  source produce `missing-source-asset` rather than a resolved payment.
- [Liability card](../src/lib/components/LiabilityPaymentCard.svelte): its
  `financialIssues` list includes only negative payment, overpayment, and negative
  remaining balance; missing-source warnings are excluded. “Needs details” and a
  select placeholder provide generic cues, not an explicit projection-risk warning.
- [Sit-down route](../src/routes/sit-down/+page.svelte): `paymentFieldError` returns
  missing-source feedback only after `standUpAttempted`. Preventing completion
  later is insufficient while the user is making payments externally.

Plan an immediate, prominent, accessible warning when a paid row lacks its source,
and an honest incomplete-projection state in the desktop rail/mobile dock. Resolve
the exact wording and presentation in planning; do not silently assign an account
or invent which balance to debit. Verify whether one incomplete row suppresses
otherwise valid projections and outline safe handling. Preserve valid draft saving
and intentional No payment rows without noisy false alarms.

Required regression outline: choose a paid mode and amount with no source before
any Stand Up attempt; ensure local and global risk are unmistakable; then select
a source that makes the asset negative and verify immediate exact subtraction and
overdraft warning. Repeat source changes/clearing, all paid modes, mobile visibility,
keyboard operation, draft reload, and intentional No payment. This is source-backed
investigation guidance, not an independently reproduced incident or completed fix.

### 2. Unsaved-work safety

Source evidence: [sit-down route](../src/routes/sit-down/+page.svelte), especially
`hasUnsavedCorrection`, `beforeNavigate`, `warnBeforeUnload`, `onDestroy`,
`markUnsaved`, and `queueDraftSave`.

- Both leave guards test only `hasUnsavedCorrection`.
- Draft edits wait 800 ms before saving. Route destruction clears that timer.
- Invalid date/money text pauses autosave and preserves only the last committed
  valid snapshot; failed writes preserve current input on screen.
- The source therefore exposes a loss window when leaving a draft before commit.
  This assessment has not independently reproduced that transition in a browser.
- Account and threshold forms also need a deliberate policy for abandonment;
  the configuration route currently has no navigation/unload guard.

The planner should define a committed-revision versus current-revision contract,
then outline guard behavior for internal navigation, reload, tab closure, pending
writes, failures, and intentionally discarded drafts. Do not assume an asynchronous
save can reliably complete during unload. Warn only when work would actually be
lost. Decide with Anthony whether preserving invalid raw text across reopening is
required; avoid introducing a second persistence system by default. Anthony has
chosen **warning plus recovery of the last saved draft**, so cross-restart storage
of invalid raw text is not required for this plan.

### 3. Desktop density and mobile visibility

Reuse [projection panel](../src/lib/components/AssetProjectionPanel.svelte),
[mobile dock](../src/lib/components/AssetProjectionDock.svelte),
[liability card](../src/lib/components/LiabilityPaymentCard.svelte), and
[shared CSS](../src/app.css).

The rail and dock already expose balances and textual risk states. Validate them
with representative account counts, long names, long notes/confirmation IDs,
large signed amounts, short landscape heights, zoom, and an open phone keyboard.
An unlimited dock grid could consume substantial screen height with many assets;
this is a stress-test hypothesis, not a reproduced failure. Ensure sticky elements
do not obscure focused controls or warnings. Let Anthony's actual entry friction
determine whether stacked cards suffice or a step-oriented mobile flow is needed.

### 4. Accessibility beyond Axe

Existing positives: labels, `aria-invalid`, live save status, focus on some invalid
inputs, semantic history table, keyboard detail controls, and textual balance
states. Existing automated scans exercise populated and empty/error states.

Concrete source gaps and checks to outline:

- No `prefers-reduced-motion` handling was found in source. Hover transforms remain;
  chart animation is already disabled.
- `src/app.css` references undefined `--focus`, `--orange`, and `--orange-soft`
  variables in archive focus/draft styles. Verify computed presentation and repair
  deliberately; Axe passing does not prove keyboard focus visibility.
- Liability error text is adjacent to fields but several inputs do not connect it
  through `aria-describedby`. Audit error announcements across all forms.
- The shell has a `main` landmark but no skip link. Assess repetitive navigation,
  route focus, and heading structure.
- Verify Stand Up dialog focus entry, trapping, Escape, return focus, and error
  recovery; scan the open dialog, not just the completed receipt.
- Verify account editor open/close/save focus and return focus after closing history
  details. Measure contrast and target sizes rather than assume conformance from
  design tokens. Some compact controls are 36–38 px; standard buttons are 44 px.
- Test signed-money entry on actual mobile keyboards: `inputmode="decimal"`
  alone does not establish that entering a minus sign is comfortable.

### 5. Complete the release evidence

[Playwright configuration](../playwright.config.ts) defines one Desktop Chrome
project. Selected tests set 375 or 390 px widths; this is not a complete mobile
suite, real phone acceptance, or WebKit/Firefox coverage.

Outline a supported browser/device matrix, full desktop/mobile critical journeys,
keyboard-only canonical entry, unsaved-work regression cases, dialog scans,
refresh/close/reopen tests, and a network-blocked smoke test after assets load.
Distinguish continued use of loaded assets from installing or cold-starting an
offline app; the latter is not an established MS-01 requirement.

Current e2e runs already build and serve production output using
[the preview runner](../scripts/run-e2e.mjs). Preserve this reuse. A clean
checkout/install gate is still required; today's verification used installed
dependencies and the existing workspace.

### 6. Reconcile documentation and release decisions

- [README](../README.md) still says export/restore is future work and lacks the
  full current backup/restore procedure and limitations.
- README incorrectly groups deployment paths with origins. Origin is determined
  by scheme, host, and port; a path change alone does not create another origin.
- Roadmap Phase 7 describes one JSON envelope; shipped recovery uses a versioned
  ZIP-compatible `.stashy` archive containing JSON. Record the chosen format in
  architecture/roadmap documentation without changing the working format merely
  to match stale prose.
- Roadmap test ownership strikes through browser tests, while standard gates and
  Phase 8 explicitly require them. Clarify this documentation inconsistency.
- Separate `AppSettings.schemaVersion = 1`, IndexedDB database version `3`, and
  backup format version `1`. Backup manifest `database.schemaVersion` refers to
  IndexedDB version `3`. Specify what Phase 8's “freeze schema version 1” means;
  do not renumber the working database to satisfy that sentence.
- Hosting is not configured here: no `.github` workflow and no repository base
  path in `vite.config.ts`. Confirm the intended URL before outlining any hosting
  work. Publishing is not authorized by this assessment request.
- Review bundle/dependency choices proportionately. The current Whiteboard route
  chunk is 211.18 kB raw / 72.32 kB gzip; Chart.js is selectively registered.
  `adapter-auto` is installed while the static adapter is used. These are review
  candidates, not automatic removal or replacement requirements.

## Automated checks executed for this assessment

| Command                                                                                                                  | Result          | Evidence                                                                        |
| ------------------------------------------------------------------------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------- |
| `npm run check`                                                                                                          | PASS            | 0 errors, 0 warnings.                                                           |
| `npm run lint`                                                                                                           | PASS            | Repository formatting and ESLint.                                               |
| `npm run test:unit`                                                                                                      | PASS            | 13 files, 127 tests.                                                            |
| `npm run test:e2e`                                                                                                       | PASS            | Included production build and 49 passing Chromium tests against preview output. |
| `npm run build`                                                                                                          | PASS within e2e | Static site written to `build/`; no separate redundant build run.               |
| Clean install/checkout gate                                                                                              | NOT RUN         | Existing installed workspace used.                                              |
| Full mobile/browser matrix, keyboard-only canonical scenario, offline smoke, real phone/screen reader, manual acceptance | NOT RUN         | Planning and acceptance work remains.                                           |

Build plugin-timing and Playwright color-environment notices were informational.
Expected 404 output occurred during error-route tests. No automated failures were
observed. This assessment does not include a fresh dependency security audit.

## Anthony's decision notes

Anthony supplied the following answers during this assessment:

1. **Visual scope:** refine the current cockpit and branding.
2. **Acceptance targets:** Brave, based on Chromium, on desktop and mobile; make
   the app usable on a 13-inch laptop too. Exact laptop CSS viewport, phone OS,
   and phone dimensions remain unspecified. Chromium automation is relevant but
   does not replace a Brave manual trial, including its actual storage/privacy
   settings. Do not infer a phone browser engine from branding alone.
3. **Prior acceptance:** Whiteboard and backup/restore were OK with no issues.
   The missing-source overdraft incident is the material workflow failure.
4. **Hosting:** GitHub Pages is the main target. Exact user/project-site URL and
   repository base path remain unspecified; confirm before deployment configuration.
5. **Unsaved work:** a clear leave warning plus recovery of the last saved draft
   is sufficient. Exact invalid raw text need not survive reopening.

Existing answers already establish desktop first, secondary mobile, tactile entry,
overdraft prevention first, manual balance snapshots, passive money warnings,
editable history with audits, and no later-session recalculation. No need to ask
those again.

## Next model's assignment

Produce a decision-aware Phase 8 plan and implementation outline, using this report
as evidence rather than as a final approved design. First reproduce the
missing-source/projection gap and the unsaved draft gap, then inspect populated UX
in Brave and representative 13-inch laptop/mobile viewports. Preserve Anthony's
chosen visual refinement and last-saved-draft recovery scope. Confirm the remaining
device dimensions and GitHub Pages URL where they affect the outline.

Recommended planning order:

1. Immediate missing-source warnings and trustworthy projection presentation,
   followed by unsaved-work/persistence transitions, with targeted regressions.
2. Keyboard, focus, errors, motion, and warning accessibility.
3. Desktop density and mobile projection/entry refinements.
4. State polish across loading, empty, success, warning, failure, and not-found.
5. Documentation/schema clarification and proportional dependency/bundle review.
6. Clean-install gates, full supported-device tests, Anthony's fabricated trials,
   visible accepted follow-ups, and final MS-01 acceptance preparation.

For each planned slice, identify existing owners/files, concrete before/after
behavior, test evidence, dependencies, and unresolved choices. Use release-blocker,
phase-blocker, and consciously deferred follow-up classifications from the roadmap.
Prepare Anthony's issue-capture checklist and a non-UI audit verification procedure.
Only Anthony can confirm replacement of the Sheet; do not mark Phase 8 or MS-01
complete solely because code and automated tests pass.

Future implementation must create the required cross-linked report, summary, and
walkthrough artifacts and update local maps only for material boundary changes.
This documentation-only hand-off requires no artifact trio.
