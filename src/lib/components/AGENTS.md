# Shared Component Map

This subtree contains reusable Svelte presentation for the Phase 0 shell and Phase 2 configuration.

- `AppShell.svelte`: persistent product-language navigation and application frame.
- `EmptyState.svelte`: reusable launchpad/placeholder callout.
- `AccountEditor.svelte`: create/rename form with asset threshold policy controls.
- `AccountList.svelte`: ordered active-account list with edit, move, and safe archive actions.
- `ThresholdDefaultsForm.svelte`: app-level default asset threshold editor.

Components receive data and action callbacks. They do not open IndexedDB or own route navigation.
Forms preserve user input after failed validation or persistence and announce errors accessibly.
