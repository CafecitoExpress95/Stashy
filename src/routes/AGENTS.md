# Route Map

This subtree owns SvelteKit routing and presentation orchestration.

## Route Rules

- Route components may compose reusable code from `$lib`.
- Move calculations, persistence, shared state, and reusable UI into `src/lib`.
- Keep page-specific transient state local when it is not shared.
- Preserve `prerender = true` and `trailingSlash = 'always'` unless the deployment strategy is
  intentionally changed.
- Document important load functions, actions, navigation behavior, and route-owned state here as
  they are introduced.

## Current Routes

- `+layout.ts`: statically prerenders the application and uses trailing-slash URLs.
- `+layout.svelte`: wraps every page in the reusable responsive application shell and publishes
  the static favicon, touch icon, and browser theme color.
- `+error.svelte`: branded 404/runtime recovery with retry and home actions.
- `+page.svelte`: branded product launchpad for current and upcoming MS-01 areas.
- `sit-down/`, `archive/`, `whiteboard/`, and `configuration/data/`: honest upcoming-phase empty states.
- `configuration/accounts/`: Phase 2 IndexedDB-backed account and threshold configuration workspace.

## Adding Routes

- Use clear product language from the design: Sit Down, Archive, Whiteboard, and Configuration.
- Keep route files focused on assembling screens and handling navigation.
- Search existing routes and `$lib` before adding duplicate controls or state.
- Add a child `AGENTS.md` when a route subtree gains distinct invariants or at least three
  substantive files.
- Update this map when routes, route ownership, important route state, or navigation behavior
  materially change.
