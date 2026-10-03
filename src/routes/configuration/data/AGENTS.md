# Data Portability Route

This subtree orchestrates the Phase 7 Save & Restore screen.

- `+page.svelte` composes `DataPortabilityWorkspace.svelte`.
- `DataPortabilityWorkspace.svelte` owns file selection, validation review, explicit replacement
  confirmation, cancellation, download, and post-restore presentation.
- `$lib/persistence` owns archive format, validation, export, and atomic IndexedDB replacement.
- The prepared validated archive uses `$state.raw` and is treated as immutable. Replace the whole
  value when selecting or canceling; never wrap its nested records in deep reactive state before
  passing them to IndexedDB's structured-clone boundary.
- Selection and cancellation never write imported data. Restore requires a valid prepared archive
  and explicit confirmation, and success appears only after the transaction commits.
