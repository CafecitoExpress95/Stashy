# Browser Test Map

This subtree owns Playwright coverage for the prerendered MS-01 application.

- `database.ts` resets the canonical `stashy` IndexedDB database between configuration scenarios.
- `routes.spec.ts` covers shell navigation, direct refresh, error recovery, responsive overflow, and Axe scans.
- `configuration.spec.ts` covers persisted account and threshold workflows, ordering, archive safety, validation, and keyboard operation.

Tests use fabricated data only. Prefer role and label locators that match the product language users see.
