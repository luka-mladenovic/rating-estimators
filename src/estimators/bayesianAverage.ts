import type { Estimator } from "../types.ts";

export interface BayesianAverageOptions {
	/**
	 * How many pretend ratings every item starts with.
	 *
	 * The more pretend ratings, the more real ratings an item needs before its
	 * own average shows through. With m = 10 and c = 4, a single 5★ rating
	 * scores (10 * 4 + 5) / 11 = 4.09, while 500 ratings averaging 4.7 score
	 * 4.69: the pretend ratings barely matter once there are many real ones.
	 *
	 * Chosen, not measured: a fixed number or a rule over
	 * the catalog. Must be the same for every item in one ranking.
	 *
	 * Must be greater than 0 and finite, or the factory throws. With m = 0 the
	 * score is just the naive mean (one 5★ outranks 500 ratings averaging 4.7),
	 * and an item with no ratings scores 0 / 0 = NaN, which breaks sorting.
	 * With m > 0 the denominator is always at least m, so an unrated item
	 * scores c. With m = Infinity every item scores Infinity / Infinity = NaN.
	 */
	readonly m: number;

	/**
	 * The star value of each pretend rating, on the 1-5 scale.
	 *
	 * It is where an item with no ratings starts, so it should be "a typical
	 * rating here": usually the average of all ratings in the catalog,
	 * computed from all items before scoring any of them.
	 *
	 * Must be between 1 and 5, or the factory throws: with c = NaN every
	 * score is NaN, and a value off the star scale gives scores that aren't
	 * stars.
	 */
	readonly c: number;
}

/**
 * Bayesian average: the plain average of the item's real ratings plus m
 * pretend ratings of value c.
 *
 *     score = (m * c + sum of real ratings) / (m + number of real ratings)
 *
 * A new item scores c; as real ratings come in, the score moves from c
 * toward the item's own average.
 *
 * In production, c and m are catalog-wide values, computed before any item
 * is scored, typically in a nightly job that writes a sortable score column:
 *
 *     // 1. Every item's counts, e.g. from a stats table:
 *     //    SELECT item_id, count_1, ..., count_5 FROM item_rating_stats
 *     const allStats = await loadAllItemStats();
 *
 *     // 2. c = the average of ALL ratings in the catalog:
 *     //    (sum of every item's rating sum) / (sum of every item's count)
 *     const c = catalogMean(allStats);
 *
 *     // 3. m = a chosen number, or a rule such as the
 *     //    25th percentile of rating counts across items
 *     const score = bayesianAverage({ m: 10, c });
 *
 *     // 4. Score every item with the same c and m and store the result:
 *     //    UPDATE item_rating_stats SET score = $2 WHERE item_id = $1
 *     for (const stats of allStats) {
 *         await saveScore(stats.itemId, score(stats));
 *     }
 *
 * Listings then sort by the stored column (ORDER BY score DESC). Between
 * nightly runs, a new rating can update its item's score with the cached c.
 */
export function bayesianAverage({ m, c }: BayesianAverageOptions): Estimator {
	// Number.isFinite is false for NaN and Infinity, so both throw.
	if (!(Number.isFinite(m) && m > 0)) {
		throw new Error(`m must be greater than 0 and finite, got ${m}`);
	}

	// The pretend ratings are stars. !(c >= 1 && c <= 5) also rejects NaN.
	if (!(c >= 1 && c <= 5)) {
		throw new Error(`c must be between 1 and 5, got ${c}`);
	}

	return (stats) => {
		const [n1, n2, n3, n4, n5] = stats.stars;
		const ratingCount = n1 + n2 + n3 + n4 + n5;
		const ratingSum = n1 + 2 * n2 + 3 * n3 + 4 * n4 + 5 * n5;

		return (m * c + ratingSum) / (m + ratingCount);
	};
}
