# Reusable Library Map

This subtree contains code intended for reuse across routes and features.

## Placement

- Put shared Svelte components, domain models, exact-money calculations, validation, stores,
  IndexedDB repositories, import/export services, and general utilities here.
- Keep a feature-specific implementation together before extracting generic layers.
- Do not import route files into `src/lib`.
- Search this subtree before introducing a shared abstraction or alternate implementation.

## Public Surface

- `index.ts` is the `$lib` barrel and explicitly names the supported domain API; do not use wildcard
  exports that can leak internal helpers.
- `domain/` owns exact money, records, configuration selectors, calculations, thresholds,
  validation, and history; read `domain/AGENTS.md` before changing it.
- `persistence/` owns the versioned IndexedDB configuration repository; read its child guide.
- `components/` owns the reusable app shell and configuration forms; read its child guide.
- Product logo and favicon assets are served from `static/` so every prerendered route uses the
  same supplied iconography.

## Map Requirements

When shared code is added, keep this file as a concise directory and symbol map:

- Name exported types, objects, services, stores, and reusable components.
- Name important non-obvious internal methods only when doing so prevents duplicate logic.
- Record invariants at the subsystem boundary, especially money and persistence rules.
- Omit routine private helpers.
- Add a child `AGENTS.md` when a subsystem gains distinct invariants or at least three substantive
  files, then leave only its responsibility and pointer here.
