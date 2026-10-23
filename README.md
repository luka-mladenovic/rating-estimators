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

## The estimators in plain terms

An overview for deciding which method to use. The sections further down explain how each one works.

Every method below is a different answer to the same question. Take three products:

- **A** has a single review: 5★.
- **B** has 500 reviews averaging 4.7★.
- **C** is new, with no reviews yet.

B is almost certainly the better product: 500 happy customers say more than one. A good ranking puts B above A, and still gives C a fair chance.

**Plain average.** Sort by the average rating. It's simple and it's what customers expect to see, but it trusts one review as much as 500, so **A (5.0) beats B (4.7)**. The top of the list fills with lucky products that have one or two reviews. Useful as a baseline, not for ranking.

**Minimum review count.** Use the plain average, but only for products with enough reviews, e.g. at least 5; the rest go to the bottom. A drops out of the way, but the problem only moves: a product with five 5★ reviews still beats B. A product one review short of the line sits at the bottom, however good its reviews. Easy to explain, but crude.

**Bayesian average.** Every product starts with a handful of pretend "typical" reviews, at the catalog's average, and real reviews gradually outweigh them. One 5★ barely moves a product (A scores 4.09), while 500 reviews move it all the way (B scores 4.69). C starts mid-table, at the catalog average. **The usual choice for a default "sort by rating".** It needs the catalog average and one setting, how many pretend reviews, recomputed regularly.

**Beta-Binomial.** The same idea for thumbs up/down: every product starts with a few pretend votes. Use it where customers vote up or down ("was this helpful?", "would you recommend?") rather than give stars. B ranks above A, and C starts mid-table.

**Wilson lower bound.** Ranks by "how good is this product **at least**, given what we know?" instead of "how good is it probably?". A product needs plenty of positive votes to rank high: A scores low and B high. It needs no catalog-wide settings, but **new products start at the very bottom**. Best for a cautious "Top rated" list, where showing a weak product costs more than missing a good new one.

**Dirichlet-Multinomial.** Combines the two ideas on full star ratings: pretend reviews like the Bayesian average, plus a penalty for uncertainty like Wilson. It also notices when customers disagree: a product with half 1★ and half 5★ ranks below one with steady 3★ reviews, since its true quality is less certain. B ranks well above A. New products start low, below products known to be mediocre, though not at the very bottom. The most complete method, and the hardest to explain.

| Method | A (one 5★) vs B (500, avg 4.7) | New product C starts | Good for |
|---|---|---|---|
| Plain average | A wins ✗ | at 0, the bottom | a baseline only |
| Minimum review count | B wins, but five 5★ beat B ✗ | at the bottom | quick fix, easy to explain |
| Bayesian average | B wins ✓ | mid-table | default "sort by rating" |
| Beta-Binomial | B wins ✓ | mid-table | thumbs up/down systems |
| Wilson lower bound | B wins ✓ | at the bottom | cautious "Top rated" lists |
| Dirichlet-Multinomial | B wins ✓ | low | stars, when caution matters |

Scores from different methods use different scales (stars, or a share between 0 and 1), so only the order each one produces can be compared, not the numbers.

**What isn't known yet:** which of these ranks products closest to their true quality, and by how much. That is what the simulation measures; results will be added here. Three further ideas are planned (see the roadmap): learning the pretend reviews from the catalog itself, giving new products occasional exposure so they can collect reviews, and counting old reviews for less.

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

Minimum-count threshold, with threshold `n` and an item's `count` ratings:

```
score = 0                          if count < n
      = sum of ratings / count     otherwise
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

Wilson lower bound (thumbs up/down), with `p̂ = k / n` and confidence `z`:

```
        p̂ + z²/(2n) - z·√( p̂(1-p̂)/n + z²/(4n²) )
lower = ------------------------------------------
                     1 + z²/n
```

Dirichlet-Multinomial (1-5 stars), with `aₖ = αₖ + nₖ` and `N = Σ aₖ`:

```
E[S]   = Σ k·aₖ / N
Var[S] = (Σ k²·aₖ / N - E[S]²) / (N + 1)
score  = E[S] - z·√Var[S]
```

The Bayesian average is the special case of the Dirichlet posterior mean where the prior is the catalog's star distribution scaled by `m`.

Kendall tau (evaluation, not an estimator), comparing two orderings of `n` items pair by pair: `C` pairs in the same order, `D` in opposite orders, `Tx` and `Ty` tied on one side only:

```
tau_a = (C - D) / (n·(n - 1) / 2)
tau_b = (C - D) / √((C + D + Tx) · (C + D + Ty))
```

## Minimum-count threshold: a cutoff

This section applies to the **minimum-count threshold** estimator. It is the simplest fix for the naive mean: an item isn't ranked by its average until it has at least `n` ratings. Below that it scores 0, under every ranked item, since a real average is at least 1★.

With `n = 5`:

| Item | Ratings | Score |
|---|---|---|
| new, no ratings | 0 | 0 |
| a single 5★ | 1 | 0 |
| four 5★ | 4 | 0 |
| five 1★ | 5 | 5 / 5 = 1.00 |
| five 5★ | 5 | 25 / 5 = 5.00 |
| 500 ratings averaging 4.7 | 500 | 2350 / 500 = 4.70 |

It fixes the naive mean's best-known failure, but moves the problem rather than solving it:

- **Fixed:** a single 5★ no longer outranks 500 ratings averaging 4.7.
- **The cliff:** four 5★ score 0, below five 1★. One more 5★ and the item jumps from the bottom to the top. Every item below the threshold ties at 0, however good its ratings.
- **Above the threshold it is the naive mean.** Five 5★ (5.00) still outrank 500 ratings averaging 4.7: the same flaw, at `n` ratings instead of 1.

### n: how many ratings count

`n` is a policy choice: a fixed number, or a rule over the catalog such as a percentile of rating counts. Too low and a few lucky ratings still win; too high and good new items stay hidden. A score of 0 sorts unranked items last; listings often hide them instead, or show them in a separate "new" section.

**`n` must be a whole number of at least 1.** With `n = 1` the threshold is off and the score is the naive mean. Below 1 a minimum count has no meaning. A decimal would quietly act as the next whole number (2.5 as 3), and `Infinity` would score every item 0. The factory rejects all of these when the estimator is created. A percentile rule can give a decimal, so round it up first: `n = Math.max(1, Math.ceil(p25))`.

**The score is in stars**, with 0 meaning "not enough ratings yet".

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

**`C` must be between 1 and 5**, since the pretend ratings are stars. The factory rejects anything else: `NaN` would make every score `NaN`, and a value such as 100 gives scores that aren't stars.

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

Negative `m` is invalid too: "minus ten pretend ratings" has no meaning, and it can divide by zero (`m = -1` with one rating). The factory rejects any `m <= 0` when the estimator is created, so the check runs once rather than per item. It rejects `m = Infinity` too: every score would be `∞ / ∞`, which is `NaN`.

A catalog rule can produce 0 on its own: if a quarter or more of the items have no ratings, their 25th percentile is 0. Clamp it, e.g. `m = Math.max(1, p25)`.

Which positive `m` ranks best is an empirical question, and one the simulation in this repo is meant to answer.

## Beta-Binomial: votes, alpha and beta

This section applies to the **Beta-Binomial** estimator. It works on two outcomes, up or down, instead of five star levels: the thumbs version of the Bayesian average.

### From stars to votes

> **Demo shortcut.** Real thumbs systems (likes, "was this review helpful?", "would you recommend?") collect up and down votes directly, so there is no neutral option and nothing is lost. Star systems use the star estimators instead. This repo converts stars to votes only so that every estimator runs on the same simulated catalog. The conversion throws away information, so part of any gap between the thumbs estimators and the star estimators in the simulation comes from the conversion, not from the method.

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

**Both must be greater than 0.** With both at 0, an item with no votes scores `0 / 0 = NaN`, which breaks sorting. With only one at 0, a new item starts at exactly 0% or 100%: the extreme the pretend votes are there to avoid. The factory rejects either when the estimator is created, and `Infinity` too, which would make every score `∞ / ∞ = NaN`.

**The score is a share between 0 and 1, not stars.** Only the order matters for ranking, so this is fine, but scores from different estimators can't be compared with each other directly: compare the rankings they produce.

## Wilson lower bound: pessimistic, not Bayesian

This section applies to the **Wilson lower bound** estimator. It reads the same up and down votes as Beta-Binomial, but answers a different question.

> **Demo shortcut.** Like Beta-Binomial, Wilson is meant for native up/down votes. Here they are converted from stars, with 3★ ignored; see "From stars to votes" above.

### Best guess vs worst plausible case

| | Bayesian average, Beta-Binomial | Wilson lower bound |
|---|---|---|
| Question | What is the best guess of the item's true rating? | How low could the item's true up-ratio plausibly be? |
| Few ratings | Pulled **toward the catalog average** | Pushed **down** |
| New item | Starts at the prior (`C`, or `alpha / (alpha + beta)`) | Starts at 0, the bottom |
| Needs | A prior: catalog-wide settings | Only the item's own votes, plus `z` |

Wilson builds a confidence interval around the item's observed up-ratio and ranks by its lower end. Few votes give a wide interval and a low bound; many votes give a narrow interval and a bound close to the observed ratio. There are no pretend votes and no prior, which makes it frequentist rather than Bayesian.

The same items under Beta-Binomial (`alpha = 8`, `beta = 2`) and Wilson (`z = 1.96`):

| Item | up / down | Beta-Binomial | Wilson |
|---|---|---|---|
| new, no ratings (or only 3★) | 0 / 0 | 0.800 | 0.000 |
| a single 5★ | 1 / 0 | 0.818 | 0.207 |
| a single 1★ | 0 / 1 | 0.727 | 0.000 |
| 9 of 10 up | 9 / 1 | 0.850 | 0.596 |
| 500 ratings averaging 4.7 | 480 / 10 | 0.976 | 0.963 |

Both rank the 500-rating item above the single 5★, and for well-reviewed items the two agree closely. They differ at the edges:

- **New items.** The Bayesian estimators place an unrated item mid-table, at the prior, above anything worse than average. Wilson puts it at the bottom, tied with items that have only down votes, so new items need another way to get noticed (see Thompson sampling in the roadmap).
- **The prior.** Beta-Binomial's result depends on choosing `alpha` and `beta` well. Wilson has nothing catalog-wide to choose or recompute: each item is scored from its own votes alone, so the nightly recompute in "Production usage" isn't needed for it.

Wilson suits lists where showing a weak item costs more than missing a good new one, such as "top rated" lists or sorting reviews by helpfulness. The Bayesian estimators suit a best-guess score that treats new items fairly.

### z: how cautious

`z` sets the confidence level: `1.96` (the default) is 95%, `2.58` is 99%. A larger `z` widens the interval and lowers every score.

With only up votes the formula collapses to `n / (n + z²)`, so a single 5★ scores `1 / (1 + 3.84) = 0.207`. That is the score Beta-Binomial would give with about 3.84 pretend down votes and no pretend ups: a pessimistic prior in all but name.

**`z` must be greater than 0.** With `z = 0` the interval has no width and the score is the raw up-ratio, `up / n`: the naive mean's flaw again, where one 5★ scores a perfect 1.0. The factory rejects it, and `Infinity` too, which would make every item with votes score `∞ - ∞ = NaN`.

**Why not the textbook interval.** The usual `p̂ ± z·√(p̂(1-p̂)/n)` has zero width when every vote is up (`p̂ = 1`), so a single 5★ gets a lower bound of 1.0. Wilson's extra `z²` terms keep the interval honest for small counts and ratios near 0 or 1.

## Dirichlet-Multinomial: stars, a prior and caution

This section applies to the **Dirichlet-Multinomial** estimator. It combines the ideas of the others: pretend ratings like the Bayesian average, and a pessimistic score like Wilson, but on all five star levels instead of up and down votes. No conversion to thumbs is needed.

### Pretend ratings at each star level

Every item has a true star distribution: the share of buyers who would give 1★, 2★, ... 5★. The Dirichlet is a belief about all five shares at once, the five-level version of the Beta. It works with pretend ratings, one count per level:

| | 1★ | 2★ | 3★ | 4★ | 5★ |
|---|---|---|---|---|---|
| prior `alpha` | 1 | 1 | 1 | 1 | 1 |
| a single 5★ | 0 | 0 | 0 | 0 | 1 |
| posterior `a` | 1 | 1 | 1 | 1 | 2 |

The **mean** of the posterior, `E[S]`, is the best guess of the item's true average: a Bayesian average whose pretend ratings are spread over the star levels instead of all sitting at `C`. Here it is `(1 + 2 + 3 + 4 + 10) / 6 = 3.33`.

The **variance**, `Var[S]`, says how sure that guess is. It grows with the spread of the ratings (a mix of 1★ and 5★ says less about the true mean than steady 3★) and shrinks as ratings come in, through the `N + 1` divisor. The score takes `z` standard deviations off the mean (see "Key formulas").

### alpha: where a new item starts, and how firmly

The **shape** of `alpha` sets where a new item starts and its **total** sets how many real ratings it takes to move it, like `m` in the Bayesian average. The default `[1, 1, 1, 1, 1]` is five pretend ratings centred on 3★. A better prior follows the catalog:

```
alpha_k = m · (the catalog's share of k★ ratings)
```

With `z = 1.96`:

| Item | `[1, 1, 1, 1, 1]` | `[2, 2, 2, 2, 2]` | `[0.5, 0.5, 1, 3, 5]` |
|---|---|---|---|
| new, no ratings | 1.868 | 2.164 | 3.495 |
| a single 5★ | 2.229 | 2.352 | 3.614 |
| five 5★ | 3.164 | 2.936 | 3.949 |
| 500 ratings averaging 4.7 | 4.623 | 4.604 | 4.631 |

- **A larger total pulls harder.** Five 5★ score 2.936 with `[2, …]` instead of 3.164. Five hundred real ratings drown out either prior.
- **A larger total is also more confident.** An unrated item scores higher with `[2, …]` (2.164 against 1.868): its mean is 3 either way, but there is less uncertainty to take off.
- **The shape matters most for new items.** The last column is `10 ×` a typical catalog's shares (`[5%, 5%, 10%, 30%, 50%]`): a new item starts at a mean of 4.15 instead of 3.

The 500-rating item ranks above five 5★ under all three priors, the case the minimum-count threshold gets wrong.

**Every value of `alpha` must be greater than 0 and finite.** It doesn't have to be a whole number. With a 0 the prior rules out a star level until a real rating arrives; `NaN` or `Infinity` would make every score `NaN`. The factory rejects all of these.

### z: how cautious

`z` works as in Wilson: `1.96` (the default) takes about two standard deviations off the mean, and a larger `z` pushes items with few ratings further down. Unlike Wilson, the prior already protects small samples, so `z` only adds caution on top.

**`z` must be greater than 0 and finite.** The factory rejects anything else. With `z = 0` the score would be just the posterior mean.

### Things to know

- **The score is in stars, but below the mean.** With few ratings it can drop under 1★, and with a weak prior and a large `z` even under 0. Only the order matters for ranking.
- **Cold start.** An unrated item scores the prior's mean minus its uncertainty: 1.868 with the defaults. That ranks it below an item with 100 ratings of 2★ (1.976). Gentler than Wilson's 0, but new items still need another way to get noticed (see Thompson sampling in the roadmap).
- **Mixed ratings score lower.** 50 × 1★ and 50 × 5★ (mean 3) score 2.624, while 100 × 3★ score 2.941: a split audience leaves the true mean less certain.

## Evaluation: Kendall tau

This section applies to the simulation, not to an estimator. Kendall tau measures how close an estimator's ranking comes to the true one: `kendallTau(trueMeans, scores)`, two parallel arrays where position `i` is the same item.

### Pairs, not positions

Kendall tau doesn't compare places in the list. For every pair of items it asks: do the truth and the estimator agree on which one is better? Four items, where the estimator swaps A and B and ties C and D at 0 (as a minimum count would):

| Item | True mean | Score |
|---|---|---|
| A | 4.5 | 4.4 |
| B | 4.0 | 4.6 |
| C | 3.5 | 0 |
| D | 3.0 | 0 |

Of the 6 pairs, 4 agree (`C = 4`), A-B disagrees (`D = 1`) and C-D is tied by the estimator only (`Ty = 1`). So `tau_a = 3 / 6 = 0.5` and `tau_b = 3 / √30 = 0.548` (see "Key formulas").

Both run from 1 (the same order) through 0 (no better than random) to -1 (reversed). Without ties, tau is the share of pairs in the right order minus the share in the wrong order: 0.6 means 80% right and 20% wrong.

### Tau-a or tau-b

The two differ only in how they treat ties, and the estimators produce plenty: every item under a minimum count scores 0, and so does every unrated item in Wilson.

- **Tau-a** counts a tied pair as neither right nor wrong: it earns nothing but still counts among all pairs.
- **Tau-b** forgives ties. It is the standard version, a proper correlation that reaches 1 whenever both sides order and tie the same pairs.

A user never sees a tie: a list shows tied items in some arbitrary order, and on average half of those pairs come out right and half wrong. The expected tau of the list a user sees is therefore tau-a, so **tau-a is the headline** and tau-b is reported beside it.

The gap shows when an estimator says little. Ten items, where the estimator picks out the true best and scores the other nine 0:

| | Value | Reads as |
|---|---|---|
| tau-a | 9 / 45 = 0.20 | one item placed right, nine in random order |
| tau-b | 9 / √(9 · 45) = 0.45 | the ties forgiven |

### Things to know

- **Only the order matters.** Scores go in as they are, with no ranking or sorting first, and scaling them doesn't change the result.
- **Everything tied gives 0.** An estimator that scores every item the same carries no information. Tau-b would be 0 / 0, so both return 0.
- **Bad input throws:** arrays of different lengths, fewer than 2 items, or a `NaN` or `Infinity` anywhere. A `NaN` score would otherwise be counted silently as a tie and hide a broken estimator.
- **Every pair is compared,** `n·(n - 1) / 2` of them: about 500,000 for 1,000 items, fast enough for the simulation.

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

- [x] Scaffold: TypeScript, Vitest, shared types
- [x] Naive mean, with a test that shows it failing
- [x] Minimum-count threshold
- [x] Bayesian average
- [x] Beta-Binomial and Wilson lower bound
- [ ] Simulation and evaluation (Kendall tau, error against the truth)

### Optional

More depth, mostly relevant at marketplace scale.

- [x] Dirichlet-Multinomial, ranked by mean minus uncertainty
- [ ] Empirical Bayes prior
- [ ] Monte Carlo sampling and Thompson sampling
- [ ] Recency weighting

## References

- Wikipedia, [Bayes estimator](https://en.wikipedia.org/wiki/Bayes_estimator), section "Practical example of Bayes estimators"
- Wikipedia, [Conjugate prior](https://en.wikipedia.org/wiki/Conjugate_prior)
- Wikipedia, [Kendall rank correlation coefficient](https://en.wikipedia.org/wiki/Kendall_rank_correlation_coefficient)
- Evan Miller, [How Not To Sort By Average Rating](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html)
- Evan Miller, [Ranking Items With Star Ratings](https://www.evanmiller.org/ranking-items-with-star-ratings.html)
