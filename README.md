# Stashy

Stashy is a local-first payment sit-down application. MS-01 is designed to replace Anthony's
Google Sheet workflow while prioritizing overdraft prevention, fast entry, clean history, and
useful analysis.

## Development

```powershell
npm install
npm run dev
```

Run the complete local quality gate with:

```powershell
npm run verify
```

The individual commands are `npm run check`, `npm run lint`, `npm run test:unit`,
`npm run test:e2e`, and `npm run build`.

## Local Data and Static Hosting

IndexedDB is Stashy's MS-01 source of truth. Browser storage is scoped to the page origin, so:

- Development and production-preview servers use different databases because their ports differ.
- Changing hostnames, ports, protocols, or deployment paths creates a different storage origin.
- Opening the built files directly with `file://` is unsupported.
- Production should use a stable HTTPS origin on a static host.

Stashy requires no application server, account, cloud database, or network connection after its
static assets load. Run `npm run build` to write the deployable site to `build/`, then use
`npm run preview` to smoke-test that output locally.

Export and restore are planned for a later MS-01 phase. Until then, browser data should be treated
as local to the exact origin where it was entered.
