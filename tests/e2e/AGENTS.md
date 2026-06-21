# Browser Test Map

This subtree owns Playwright coverage for the prerendered MS-01 application.

- `database.ts` resets the canonical `stashy` IndexedDB database and seeds deterministic cockpit accounts.
- `routes.spec.ts` covers shell navigation, static branding assets, direct refresh, error recovery,
  responsive overflow, and Axe scans.
- `configuration.spec.ts` covers persisted account and threshold workflows, ordering, archive safety, validation, and keyboard operation.
- `cockpit.spec.ts` covers the canonical payment scenario, optional statement balances, immediate projection updates, source switching, draft reload, Stand Up validation, Axe, mobile overflow, and sticky asset visibility.

Tests use fabricated data only. Prefer role and label locators that match the product language users see.
