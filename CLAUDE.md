# rating-estimators

A TypeScript learning project: ways to rank items by star ratings when review counts are small or uneven, compared by a simulation with a known ground truth. The README holds the theory, formulas and roadmap; read it before working on a new estimator.

## Commands

- `npm test` - run the tests once
- `npm run typecheck` - `tsc --noEmit` (TypeScript 7)
- `npm run lint` / `npm run lint:fix` - Biome check / fix (lint + format)

There is no ESLint: typescript-eslint doesn't support TypeScript 7 yet.

## Data flow

Rating rows -> `aggregate` (like a SQL `GROUP BY`) -> `ItemStats` (a 5-tuple of star counts) -> `Estimator` -> score. All types are in `src/types.ts`. Thumbs-based estimators convert stars to votes with `toThumbs` (4-5★ up, 1-2★ down, 3★ ignored). This is a demo shortcut so every estimator can run on one catalog.

## Estimator conventions

- One file per estimator in `src/estimators/`, with a matching test in `test/estimators/`.
- An estimator with parameters is a factory: it takes a readonly options object (`interface <Name>Options`) and returns an `Estimator`.
- Validate options in the factory and throw an error that shows the bad value. Write checks as the negated valid condition, e.g. `!(x > 0)` or `!(x >= 1)`, not `x <= 0`, so NaN is rejected too.
- An item with no ratings (or no votes) returns a defined number, never NaN, so sorting doesn't break.
- Doc comments are plain language. They cover:
  - the formula, drawn in ASCII
  - what each option does and the valid range
  - edge cases (no ratings, cold start)
  - whether the score is in stars or a 0..1 share
- Inline comments explain each step of the formula.
- Imports use the `.ts` extension.

## Test conventions

- Use a local `stats(stars)` helper to build `ItemStats`.
- Use an `it.each` table of named cases. Prefer exact expected values written as the formula (e.g. `(40 + 5) / 11`), checked with `toBeCloseTo(expected, 5)`. When there is no closed form (e.g. Wilson with mixed votes), use values computed separately, rounded to 3 decimals, in a separate table checked with `toBeCloseTo(expected, 3)`. Never compute the expected value with the code's own formula.
- Add behaviour tests (bounds, what happens as the rating count grows, the effect of each option).
- Document each method's known weakness with a test and a comment: `it.fails` when the method gets the ranking wrong (the naive mean ranks a single 5★ above 500 ratings averaging 4.7); a normal test when it's accepted behaviour (Wilson scores an unrated item 0).
- Test that invalid options throw, including NaN and boundary values.

## Finishing an estimator

Run `/done` (`.claude/skills/done/SKILL.md`). In short: tests, typecheck and lint pass; the README has the method's section, its formula and a table row; the roadmap box is ticked.

## Style

- Format with Biome: tabs, double quotes. Files are UTF-8 without a BOM, with LF line endings (see `.editorconfig`).
- In comments and docs, use "-" instead of long dashes (—, –).
- Keep company and product names out of code, comments and the README. The repo is meant to be public.
