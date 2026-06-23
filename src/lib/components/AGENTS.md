# Shared Component Map

This subtree contains reusable Svelte presentation for the application shell, configuration, and sit-down cockpit.

- `AssetProjectionPanel.svelte`: source-asset opening input, projected balance, threshold state, and prominent zero/overdraft warning.
- `AssetProjectionDock.svelte`: compact sticky projected balances and risk states for stacked/mobile cockpit layouts.
- `LiabilityPaymentCard.svelte`: focused liability balances, source/no-source, mode including No payment, payment result, confirmation, notes, and warning controls.
- `SessionReplayDetails.svelte`: reusable read-only rendering for complete and intentionally incomplete saved snapshots, resolving current account names and archived accounts.
- `SitDownReceipt.svelte`: completion framing around the shared replay details plus the new-session handoff.
- `AppShell.svelte`: persistent product-language navigation and application frame using the
  supplied static Stashy logo.
- `EmptyState.svelte`: reusable launchpad/placeholder callout.
- `AccountEditor.svelte`: create/rename form with asset threshold policy controls.
- `AccountList.svelte`: ordered active-account list with edit, move, and safe archive actions.
- `ThresholdDefaultsForm.svelte`: app-level default asset threshold editor.
- `AccountHistoryChart.svelte`: responsive Chart.js final-balance line with current threshold annotations and point-selection callbacks.

Components receive data and action callbacks. They do not open IndexedDB or own route navigation.
Forms preserve user input after failed validation or persistence and announce errors accessibly. Cockpit components remain presentation-only; the route owns mutable form state and the domain adapter owns calculations.
