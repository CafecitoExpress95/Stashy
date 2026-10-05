# Browser Test Map

This subtree owns Playwright coverage for the prerendered MS-01 application.

- `database.ts` resets the canonical `stashy` IndexedDB database and seeds deterministic cockpit accounts under the current schema.
- `routes.spec.ts` covers shell navigation, static branding assets, direct refresh, error recovery, responsive overflow, and Axe scans.
- `configuration.spec.ts` covers persisted account and threshold workflows, ordering, archive safety, validation, and keyboard operation.
- `browser-identity.spec.ts` forwards production requests under an actual nonsecure HTTP browser origin to prove native randomUUID absence. It covers account creation, new/resumed/completed drafts, stable and distinct IDs, correction audits, and history reads without secure random generation, using a phone viewport.
- `cockpit.spec.ts` covers exact projections, default No payment rows, paid-mode toggle/deselect behavior, debounced autosave, manual draft saving, draft discard, invalid-input preservation, confirmed Stand Up, durable receipts, new-session creation, failed-write messaging, Axe, mobile overflow, and sticky asset visibility.
- Slice A cockpit regressions exercise immediate source warnings in every paid mode, shared announcement stability, rail/card focus actions, partial overdraft preservation across missing/invalid openings, draft reload and breakpoint resizing, and independent projections during invalid date/optional statement input at desktop, phone, and short-height viewports.
- `archive.spec.ts` covers newest-first summaries, draft/completed replay, draft discard, explicit audited corrections, later-session isolation, current renamed/archived account resolution, missing links, Axe, and mobile overflow.
- Draft replay coverage checks re-derived running balances and unassigned paid-source wording against deliberately misleading legacy draft final values.
- `whiteboard.spec.ts` covers latest stood-up state, draft exclusion, exact Chart.js/table history including No payment details, threshold labels, chart and keyboard detail selection, sparse/same-date/archived accounts, Archive links, Axe, and mobile overflow.
- `data-portability.spec.ts` covers actual UI backup round trips, all-six-store replacement, archived accounts, drafts, nested correction audits, exact restored projections, cancellation, invalid archives, native synchronous clone failures, aborted transactions, clean retry, Axe, and mobile containment.

Tests use fabricated data only. Prefer role and label locators that match the product language users see.
