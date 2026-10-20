import type { Estimator } from "../types.ts";
import { naiveMean } from "./naiveMean.ts";

export interface MinimumCountOptions {
	/**
	 * How many ratings an item needs before it is ranked by its average.
	 *
	 * Below this, the item scores 0, which puts it under every ranked item
	 * (a real average is at least 1). With n = 1 the score is just the naive
	 * mean.
	 *
	 * Chosen, not measured: too low and a few lucky ratings still win, too
	 * high and good new items stay hidden. Must be the same for every item
	 * in one ranking.
	 *
	 * Must be a whole number of at least 1, or the factory throws. A decimal
	 * would quietly act as the next whole number (2.5 as 3), and Infinity
	 * would score every item 0. If n comes from a rule that can give a
	 * decimal, such as a percentile of rating counts, round it up first
	 * with Math.ceil.
	 */
	readonly n: number;
}

/**
 * Minimum-count threshold: the naive mean, but only for items with enough
 * ratings.
 *
 *     score = 0                          if ratingCount < n
 *     score = ratingSum / ratingCount    otherwise
 *
 * The score is in stars (1-5), with 0 meaning "not enough ratings yet".
 *
 * Edge cases:
 * - An item with no ratings scores 0.
 * - Every item below the threshold ties at 0, however good its ratings.
 * - At the threshold the score jumps from 0 straight to the full average,
 *   and above it nothing holds a small sample back: five 5★ ratings still
 *   beat 500 ratings averaging 4.7.
 */
export function minimumCount({ n }: MinimumCountOptions): Estimator {
	// Number.isInteger is false for NaN, Infinity and decimals, so all three
	// throw along with anything below 1.
	if (!(Number.isInteger(n) && n >= 1)) {
		throw new Error(`n must be at least 1 and a whole number, got ${n}`);
	}

	return (stats) => {
		// How many ratings the item has: the sum of the five star counts.
		const [n1, n2, n3, n4, n5] = stats.stars;
		const ratingCount = n1 + n2 + n3 + n4 + n5;

		// Too few to trust the average yet: rank below every rated item.
		if (ratingCount < n) {
			return 0;
		}

		// Enough ratings: the plain average of the stars.
		return naiveMean(stats);
	};
}
