# Browser Test Map

This subtree owns Playwright coverage for the prerendered MS-01 application.

- `database.ts` resets the canonical `stashy` IndexedDB database and seeds deterministic cockpit accounts under the current schema.
- `routes.spec.ts` covers shell navigation, static branding assets, direct refresh, error recovery, responsive overflow, and Axe scans.
- `configuration.spec.ts` covers persisted account and threshold workflows, ordering, archive safety, validation, and keyboard operation.
- `cockpit.spec.ts` covers exact projections, default No payment rows, paid-mode toggle/deselect behavior, debounced autosave, manual draft saving, draft discard, invalid-input preservation, confirmed Stand Up, durable receipts, new-session creation, failed-write messaging, Axe, mobile overflow, and sticky asset visibility.
- `archive.spec.ts` covers newest-first summaries, draft/completed replay, draft discard, explicit audited corrections, later-session isolation, current renamed/archived account resolution, missing links, Axe, and mobile overflow.
- `whiteboard.spec.ts` covers latest stood-up state, draft exclusion, exact Chart.js/table history including No payment details, threshold labels, chart and keyboard detail selection, sparse/same-date/archived accounts, Archive links, Axe, and mobile overflow.

Tests use fabricated data only. Prefer role and label locators that match the product language users see.
