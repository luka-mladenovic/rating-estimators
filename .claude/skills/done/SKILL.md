---
name: done
description: Review a finished estimator or code change in rating-estimators - run tests, typecheck and lint, check the code and tests against the project conventions, list README gaps, and report findings without editing. Use when the user types /done or says they are done with an estimator or a change in src/ or test/.
argument-hint: "[estimator name]"
---

# Review a finished step

The user wrote the code; this is the review. **Don't edit any files.** Report findings and let the user make the changes.

## 1. Find what changed

- If an argument was given (`$ARGUMENTS`), review `src/estimators/$ARGUMENTS.ts` and its test.
- Otherwise run `git status --short` and review the new or modified files in `src/`, `test/` and `README.md`.
- If nothing is uncommitted, review the last commit: `git show --stat HEAD`.

## 2. Run the checks

Run all three, even if one fails:

- `npm test` - expected `it.fails` tests count as passing
- `npm run typecheck`
- `npm run lint` - formatting errors only need `npm run lint:fix`; say so instead of listing each one

Also check the changed files for a UTF-8 BOM or CRLF line endings: `head -c3 <file> | od -c` and `grep -c $'\r' <file>`.

## 3. Review the source

Check it against "Estimator conventions" in `CLAUDE.md`. In addition:

- Work out one or two cases by hand and compare them with the code.
- Look for repeated logic that an existing helper (`naiveMean`, `toThumbs`) already covers.

## 4. Review the tests

Check them against "Test conventions" in `CLAUDE.md`. In addition, look for missing edge cases:

- no ratings, a single rating, only 3★ (for thumbs estimators)
- boundary values of each option (just below, at and just above a threshold or limit)
- that hand-checked expected values match what you worked out in step 3

## 5. List README gaps

The README usually comes after the code review, so report what's still missing rather than treating it as a failure:

- a section for the method
- its formula under "Key formulas"
- a row in the Estimators table
- its box ticked in the Roadmap
- no long dashes, no company or product names

## 6. Report

Keep it short, in this order:

1. **Checks** - one line each: tests (pass/fail count), typecheck, lint, encoding.
2. **Must fix** - bugs, failing checks, wrong maths. Give `file:line` and the reason.
3. **Suggestions** - conventions, missing tests. Leave out anything trivial.
4. **README still missing** - one line, if anything.
5. **Good** - one or two lines on what works well, only if it's specific.

Then ask **one** check question about the method's behaviour (e.g. what it scores for a given input, or how it ranks two items), and wait for the answer.
