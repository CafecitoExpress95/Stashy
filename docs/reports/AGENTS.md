# Test Report Format

Create one report for each qualifying implementation task using the shared identifier defined in
`docs/AGENTS.md`.

## Required Sections

1. **Scope** — what behavior and changed areas were verified.
2. **Automated Checks** — exact commands or tools, each marked pass, fail, or not run.
3. **Observed Results** — concise evidence; do not paste large logs.
4. **Failures and Risks** — warnings, skipped coverage, residual risk, and known blockers.
5. **Anthony's Tests** — concrete manual or product-judgment checks still required.

## Evidence Rules

- Never claim an unexecuted check passed.
- Distinguish failures caused by the change from pre-existing or environmental failures.
- Include expected and actual results for failed checks.
- Link the matching executive summary and walkthrough near the top.
- Record the user-specified MS-01 phase.
