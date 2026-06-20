# Documentation Guide

This file supplements the repository-level `AGENTS.md` for `docs/`.

## Authority

- `DESIGN_DOC.md` is the authority for product intent and the MS-01 user experience.
- `MVP_ROADMAP.md` is the authority for delivery phases, test ownership, gates, and acceptance.
- `ARCHITECTURE.md` records approved stored-data decisions, naming, deployment, and migration conventions.
- The user specifies the active phase; reports must record it without advancing it.
- Completion artifacts describe completed work. They must not redefine requirements or silently
  settle unresolved product decisions.

## Completion Artifacts

Implementation tasks requiring artifacts create three Markdown files with one shared identifier:

`YYYY-MM-DD-HHmm-<short-task-slug>.md`

Use local project time. If an identifier already exists, append `-02`, `-03`, and so on.
Cross-link all three files:

- `reports/`: exact verification evidence and remaining manual tests.
- `summaries/`: concise executive outcome and roadmap impact.
- `walkthroughs/`: code-linked tour for review and feedback.

Read the applicable child `AGENTS.md` before writing an artifact. Do not create artifact trios for
documentation-only, comment-only, or read-only tasks unless the user requests them.

## Documentation Quality

- Prefer links to authoritative sections over copied requirements.
- Keep historical reports factual and immutable; correct material errors explicitly.
- Use repository-relative links between documentation files.
- Use absolute clickable file links with starting line numbers in final chat responses.
