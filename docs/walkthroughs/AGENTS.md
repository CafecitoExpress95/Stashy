# Executive Walkthrough Format

Create one walkthrough for each qualifying implementation task using the shared identifier defined
in `docs/AGENTS.md`.

## Required Structure

- Open with the outcome, the user-specified MS-01 phase, and links to the summary and test report.
- Organize the body as ordered **Tour Stops** grouped by behavior or data flow.
- For each stop, link to the most relevant changed file and exact starting line.
- Explain in plain language what changed, why it exists, and how it connects to adjacent code.
- End each stop with a focused prompt telling Anthony what decision, behavior, or code shape to
  inspect and comment on.
- Close with a short end-to-end flow when the change crosses multiple areas.

Omit generated and mechanical files unless they materially affect behavior or review. This is a
guided factory tour, not an exhaustive diff inventory.
