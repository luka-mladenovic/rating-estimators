# rating-estimators

Ranking products by star ratings when some have 500 reviews and others have 2.

A TypeScript study of the ways to estimate an item's true rating from a small, noisy sample, and a simulation that compares them against known ground truth.

## The problem

Every product has a **true quality**: the average rating it would get if every buyer rated it. We never see that number. We only see the reviews left so far, and their average is an estimate of it, and a poor one when there are few of them.

Sorting by the plain average rewards luck. Take 1,000 products that are all truly 4.0★, each with 2 reviews: by chance, dozens of them will show 5.0. Mixed into a catalog, these low-review items crowd the top and bottom of a "sort by rating" list, while a product with 500 reviews averaging 4.7 can never reach the top, because its average is too precise to land on an extreme by chance.

A good ranking has to answer three questions:

1. **What is the best guess of each item's true quality?** One review should count for less than 500.
2. **How sure is that guess?**
3. **What order should be shown, given that uncertainty?** This includes how new items ever get noticed.

## Approach

Each method is an **estimator**: a function from an item's ratings to a score. All estimators share one interface, so they can be swapped and compared on the same data.

The **simulation** is how they are judged. It invents a catalog where each item's true rating distribution is known, draws a realistic number of fake reviews from each, runs every estimator, and measures how close each ranking comes to the true one. In real data the truth is hidden; here it isn't, so "which method is better" has a measurable answer.

## Estimators

| Estimator | Idea | Answers |
|---|---|---|
| Naive mean | Average of the ratings. The baseline that shows the problem | - |
| Minimum-count threshold | Ignore items below N ratings | 1, crudely |
| Bayesian average | Pull each item's mean toward the catalog mean, weighted by review count | 1 |
| Beta-Binomial | Thumbs up/down: posterior `Beta(α + ups, β + downs)` | 1, 2, 3 |
| Wilson lower bound | Frequentist confidence bound for up/down ratios | 3 |
| Dirichlet-Multinomial | 1-5 stars: posterior `Dirichlet(αₖ + nₖ)`, ranked by mean minus uncertainty | 1, 2, 3 |
| Empirical Bayes | Fit the prior from the catalog instead of choosing it by hand | 1 |
| Thompson sampling | Rank by a random draw from each posterior, so new items get exposure | 3 (exploration) |
| Recency weighting | Older ratings count less | data quality |

## Key formulas

Bayes' theorem: the updated belief is the prior belief weighted by how well each candidate value explains the data.

```
posterior ∝ likelihood × prior
```

Bayesian average, with catalog mean `C`, prior weight `m` (pseudo-votes), and an item's `n` ratings:

```
score = (m·C + sum of ratings) / (m + n)
      = w · item mean + (1 - w) · C        where w = n / (n + m)
```

Beta-Binomial (thumbs up/down), with prior `Beta(α, β)` and `k` ups out of `n`:

```
posterior = Beta(α + k, β + n - k)
mean      = (α + k) / (α + β + n)
```

Dirichlet-Multinomial (1-5 stars), with `aₖ = αₖ + nₖ` and `N = Σ aₖ`:

```
E[S]   = Σ k·aₖ / N
Var[S] = (Σ k²·aₖ / N - E[S]²) / (N + 1)
score  = E[S] - z·√Var[S]
```

The Bayesian average is the special case of the Dirichlet posterior mean where the prior is the catalog's star distribution scaled by `m`.

## Bayesian average: choosing C and m

This section applies to the **Bayesian average** estimator only. `C` and `m` are its two settings; the other estimators have different parameters (or none, like the naive mean).

The Bayesian average is easiest to read as **pretend ratings**: every item starts with `m` pretend ratings of value `C` (`c` in the code), real ratings are added on top, and the score is the plain average of all of them.

With `m = 10` and `C = 4`:

| Item | Ratings averaged | Score |
|---|---|---|
| new, no ratings | ten pretend 4★ | 40 / 10 = 4.00 |
| one real 5★ | ten pretend 4★ + one 5★ | 45 / 11 = 4.09 |
| 500 real, averaging 4.7 | ten pretend 4★ + 500 real (sum 2350) | 2390 / 510 = 4.69 |

A single happy customer barely moves an item; 500 customers drown out the pretend ratings. Both values are catalog-wide: computed from all items before any item is scored, and the same for every item in one ranking.

### C: where a new item starts

`C` is the average of **all ratings in the catalog**: the sum of every item's ratings divided by the total number of ratings. Items with many ratings weigh more than in an average of item averages, which is intended. Rank categories separately and each can have its own `C`.

### m: how much evidence an item needs

`m` is a policy choice. An item with exactly `m` ratings lands halfway between its own average and `C`.

| m | One 5★ rating with C = 4 | Behaviour |
|---|---|---|
| 1 | 4.50 | trusts a single rating quickly |
| 10 | 4.09 | needs a fair amount of evidence |
| 100 | 4.01 | very sceptical |

Two common ways to set it:

- **A fixed number**, such as 7 or 10. Simple and easy to explain.
- **A rule over the catalog**, such as the **25th percentile of rating counts**: sort every item's number of ratings from fewest to most and take the value a quarter of the way along. For counts `0, 2, 3, 5, 8, 20, 50, 400` that is about 3 (Postgres `PERCENTILE_CONT(0.25)` gives 2.75). In words: an item needs about as many ratings as the less-reviewed quarter of the catalog before its own average carries half the weight. The rule adapts to the shop: a small catalog gets a small `m`, a busy marketplace a larger one. A percentile is used rather than the average count because a few bestsellers drag the average up: here the average is about 61, which would keep almost every item pinned to `C`.

**`m` must be greater than 0.** With no pretend ratings:

- **It is no longer a Bayesian average.** `(0·C + sum) / (0 + n)` is `sum / n`, the naive mean, with exactly the flaw this estimator exists to fix: one 5★ rating (5.0) outranks 500 ratings averaging 4.7. When that is really what's wanted, use the naive mean directly rather than a setting that quietly switches the method off.
- **An item with no ratings has no score.** `(0·C + 0) / (0 + 0)` is `0 / 0`, which is `NaN` in JavaScript, not an error. `NaN` compares as neither greater nor smaller than anything, so it breaks sorting silently. With `m > 0` the denominator is always at least `m`, so every item gets a number and an unrated item scores exactly `C`, with no special case.

Negative `m` is invalid too: "minus ten pretend ratings" has no meaning, and it can divide by zero (`m = -1` with one rating). The factory rejects any `m <= 0` when the estimator is created, so the check runs once rather than per item.

A catalog rule can produce 0 on its own: if a quarter or more of the items have no ratings, their 25th percentile is 0. Clamp it, e.g. `m = Math.max(1, p25)`.

Which positive `m` ranks best is an empirical question, and one the simulation in this repo is meant to answer.

## Beta-Binomial: votes, alpha and beta

This section applies to the **Beta-Binomial** estimator. It works on two outcomes, up or down, instead of five star levels: the thumbs version of the Bayesian average.

### From stars to votes

Votes are derived from the same star counts every estimator reads (`toThumbs`), so all estimators can be compared on one catalog:

| Stars | Counts as |
|---|---|
| 4★, 5★ | up |
| 1★, 2★ | down |
| 3★ | ignored: neither a like nor a dislike |

Ignoring 3★ has a consequence worth knowing: an item with only 3★ ratings has zero votes, so it scores like an unrated item. Counting 3★ as down is the stricter alternative.

### alpha and beta: pretend votes

Every item starts with `alpha` pretend up votes and `beta` pretend down votes; real votes are added on top, and the score is the share of up votes:

```
score = (alpha + up) / (alpha + beta + up + down)
```

They map directly onto the Bayesian average's settings:

| Bayesian average | Beta-Binomial | Meaning |
|---|---|---|
| `C` | `alpha / (alpha + beta)` | where a new item starts |
| `m` | `alpha + beta` | how many pretend votes, so how much evidence an item needs |

To set them, pick a prior up-ratio `μ` and a strength `m`, then `alpha = m·μ` and `beta = m·(1 - μ)`:

- `μ` is usually the catalog's overall share of up votes: total up votes divided by total votes, across all items.
- `m` is chosen exactly as for the Bayesian average: a fixed number, or a rule such as the 25th percentile of vote counts.

With `m = 10` and `μ = 0.8`, so `alpha = 8` and `beta = 2`:

| Item | up / down | Score |
|---|---|---|
| new, no ratings (or only 3★) | 0 / 0 | 8 / 10 = 0.800 |
| a single 5★ | 1 / 0 | 9 / 11 = 0.818 |
| a single 1★ | 0 / 1 | 8 / 11 = 0.727 |
| 500 ratings averaging 4.7 | 480 / 10 | 488 / 500 = 0.976 |

**Both must be greater than 0.** With both at 0, an item with no votes scores `0 / 0 = NaN`, which breaks sorting. With only one at 0, a new item starts at exactly 0% or 100%: the extreme the pretend votes are there to avoid. The factory rejects either when the estimator is created.

**The score is a share between 0 and 1, not stars.** Only the order matters for ranking, so this is fine, but scores from different estimators can't be compared with each other directly: compare the rankings they produce.

## Production usage

This applies to any estimator; the example job uses the Bayesian average.

Scores are rarely computed at request time. Sorting a listing by a score calculated inside the query means aggregating every item's ratings on every request, and no index can help. The usual setup stores the counts and the score:

```sql
CREATE TABLE item_rating_stats (
    item_id     uuid PRIMARY KEY REFERENCES item(id),
    count_1     int NOT NULL DEFAULT 0,
    count_2     int NOT NULL DEFAULT 0,
    count_3     int NOT NULL DEFAULT 0,
    count_4     int NOT NULL DEFAULT 0,
    count_5     int NOT NULL DEFAULT 0,
    score       numeric NOT NULL,
    updated_at  timestamptz NOT NULL
);
CREATE INDEX ON item_rating_stats (score DESC);
```

- **Counts** are exact, cheap to update, and enough to recompute any score (or switch formulas) without rescanning the ratings table. They also drive the star histogram on product pages.
- **Score** is what listings sort by: `ORDER BY score DESC LIMIT 20` uses the index.

| When | What happens |
|---|---|
| A rating is written | In the same transaction, increment the matching count and recompute that item's score with the cached `C` and `m`. |
| Nightly | Recompute `C` (and `m`, if it's a rule) from the stats table, then recompute every score. |
| Occasionally | Rebuild all counts from the ratings table with `GROUP BY` to repair any drift. |

The nightly job, using this repo's functions:

```ts
const allStats = await loadAllItemStats();     // SELECT item_id, count_1, ..., count_5
const c = catalogMean(allStats);               // average of all ratings
const score = bayesianAverage({ m: 10, c });   // same c and m for every item

for (const stats of allStats) {
	await saveScore(stats.itemId, score(stats)); // UPDATE ... SET score = ...
}
```

The number shown to customers is often **not** the ranking score: product pages usually show the plain average and the count ("4.6★, 53 ratings"), which people can check against the reviews, while listings sort by the Bayesian score.

## Roadmap

### Core

The methods most stores actually ship, and a way to compare them.

- [ ] Scaffold: TypeScript, Vitest, shared types
- [ ] Naive mean, with a test that shows it failing
- [ ] Bayesian average
- [ ] Beta-Binomial and Wilson lower bound
- [ ] Simulation and evaluation (Kendall tau, error against the truth)

### Optional

More depth, mostly relevant at marketplace scale.

- [ ] Dirichlet-Multinomial, ranked by mean minus uncertainty
- [ ] Empirical Bayes prior
- [ ] Monte Carlo sampling and Thompson sampling
- [ ] Recency weighting

## References

- Wikipedia, [Bayes estimator](https://en.wikipedia.org/wiki/Bayes_estimator), section "Practical example of Bayes estimators"
- Wikipedia, [Conjugate prior](https://en.wikipedia.org/wiki/Conjugate_prior)
- Evan Miller, [How Not To Sort By Average Rating](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html)
- Evan Miller, [Ranking Items With Star Ratings](https://www.evanmiller.org/ranking-items-with-star-ratings.html)
