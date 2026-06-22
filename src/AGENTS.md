# Source Map

This file supplements the repository-level `AGENTS.md` for everything under `src/`.

## Boundaries

- `routes/` owns SvelteKit pages, layouts, route loading, navigation, and route-local orchestration.
- `lib/` owns reusable components, domain types, calculations, stores, persistence, services, and
  utilities.
- Keep business rules and reusable state out of route components.
- `app.html` is the document shell; change it only for application-wide HTML concerns.
- `app.d.ts` holds application-wide TypeScript declarations, not ordinary domain types.

Read the child guide for the subtree being changed:

- `src/routes/AGENTS.md`
- `src/lib/AGENTS.md`

## Current Top-Level Map

- `app.html`: SvelteKit HTML template.
- `app.css`: application-wide responsive acorn-and-cash visual foundation and form styles.
- `app.d.ts`: global application declaration scaffold.
- `routes/`: prerendered product shell, branded launchpad, durable sit-down and correction lifecycle, Archive list/replay, Whiteboard analysis, later-phase placeholders, error recovery, and configuration orchestration.
- `lib/index.ts`: public barrel exporting the reusable domain API.
- `lib/charting/`: Chart.js adaptation for exact account-history series and threshold annotations.
- `lib/components/`: shared shell, configuration, cockpit, session-replay, and account-history presentation; read its child guide.
- `lib/persistence/`: IndexedDB schema plus configuration, archive, and audited sit-down lifecycle repositories; read its child guide.

## Conventions

- Use TypeScript for application logic.
- Follow the repository Prettier and ESLint configuration.
- Prefer small focused Svelte components and explicit data flow.
- Before creating a new source directory, decide whether it is route-specific or reusable and place
  it under the matching boundary.
- Update this map only when top-level ownership or cross-subtree data flow changes.
