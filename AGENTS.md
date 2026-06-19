# Stashy Agent Guide

## Mission

Build MS-01 so Anthony can replace his payment-sit-down Google Sheet with Stashy.
When priorities compete, preserve this order:

1. Prevent overdrafts.
2. Make data entry fast.
3. Keep clean historical records.
4. Provide useful analysis.

## Load Only What You Need

- Read this file for every repository task.
- For a target file, also read only the `AGENTS.md` files in its ancestor directories.
- Do not recursively load unrelated `AGENTS.md` files.
- The user names the active MS-01 phase. Do not infer, change, or advance it.
- For implementation, read only that phase in `docs/MVP_ROADMAP.md`.
- Consult targeted sections of `docs/DESIGN_DOC.md` when product intent remains unclear.
- User instructions override repository guidance when they explicitly conflict.

## MS-01 Guardrails

- Use exact decimal arithmetic for money; never use floating point as the source of truth.
- Balances are manually entered snapshots.
- Planned payments reduce projected source-asset balances immediately.
- Negative, zero, and overpayment states warn without blocking valid messy records.
- IndexedDB is the MS-01 source of truth, with file export and restore.
- Keep records ID-based and history-preserving; editing old sessions does not recalculate later ones.
- Desktop is first-class, and mobile must remain usable.
- Do not expand MS-01 into budgeting, bank integration, reminders, transaction import, payment
  status tracking, multi-user support, encryption, or a generalized ledger.

## Working Rules

- Inspect before editing. Search the relevant subtree before adding a feature, component, type,
  object, service, store, utility, or method.
- Reuse established implementations and boundaries instead of creating parallel abstractions.
- Keep route orchestration in `src/routes` and reusable UI/domain/data logic in `src/lib`.
- Avoid speculative infrastructure, broad refactors, and unrelated cleanup.
- Preserve unrelated user changes and report conflicts instead of overwriting them.
- Ask for the MS-01 phase before implementation if the user has not supplied one. Read-only
  inspection and documentation-only work may proceed without a phase.

## Maintain Local Maps

- Every code-changing task must inspect the applicable local `AGENTS.md`.
- Update it only when ownership, exported/shared symbols, important methods, data flow, or local
  invariants materially change.
- Do not catalog routine private helpers or keep chronological change logs.
- Add a child `AGENTS.md` when a subtree gains distinct invariants or at least three substantive
  implementation files; replace parent detail with a short pointer.

## Verification and Handoff

- Run checks proportionate to the active phase and risk.
- Until dedicated test scripts exist, the baseline is `npm run check`, `npm run lint`, and
  `npm run build`.
- Never report an unexecuted check as passed; state failures, skipped checks, and residual risk.
- Completed tasks changing source, tests, runtime configuration, dependencies, or build behavior
  must create the three cross-linked artifacts defined under `docs/`.
- Documentation-only, comment-only, and read-only tasks need no artifact trio unless requested.
- Final responses should give a short outcome, test status, risks, and links to any artifacts.

## Security

- Do not use encoded PowerShell commands (e.g. BASE64 encoded commands)
- Avoid PowerShell commands likely to trip antivirus
