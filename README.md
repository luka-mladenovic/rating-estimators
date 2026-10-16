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
