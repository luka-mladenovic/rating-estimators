import type {Estimator, StarCounts} from "../types.ts";

export interface DirichletOptions {
	/**
	 * How many pretend ratings every item starts with at each star level,
	 * 1★ to 5★.
	 *
	 * Their shape sets where a new item starts, and their total sets how many
	 * real ratings it takes to move it, like m in the Bayesian average. The
	 * default [1, 1, 1, 1, 1] is five pretend ratings centred on 3★. A better
	 * prior follows the catalog: alpha = m * (the catalog's share of each
	 * star level). With m = 10 and shares [5%, 5%, 10%, 30%, 50%],
	 * alpha = [0.5, 0.5, 1, 3, 5] and a new item's mean starts at 4.15.
	 *
	 * Every value must be greater than 0 and finite, or the factory throws.
	 * They don't need to be whole numbers.
	 */
	readonly alpha?: StarCounts;

	/**
	 * How cautious the score is: how many standard deviations are taken off
	 * the mean. The default 1.96 matches Wilson's 95%. A larger z pushes
	 * items with few ratings further down.
	 *
	 * Must be greater than 0 and finite, or the factory throws. With z = 0
	 * the score would be just the mean, a Bayesian average with pretend
	 * ratings spread over the star levels.
	 */
	readonly z?: number;
}

/**
 * Dirichlet-Multinomial: the item's mean rating, counting pretend ratings at
 * each star level, minus z times how unsure that mean still is.
 *
 *     a_k    = alpha_k + n_k       pretend + real ratings at k★
 *     N      = a_1 + ... + a_5
 *     E[S]   = (1·a_1 + 2·a_2 + ... + 5·a_5) / N
 *     E[S²]  = (1·a_1 + 4·a_2 + ... + 25·a_5) / N
 *     Var[S] = (E[S²] - E[S]²) / (N + 1)
 *
 *     score  = E[S] - z·√Var[S]
 *
 * E[S] is the best guess of the item's true mean. Var[S] shrinks as ratings
 * come in, so the penalty fades and the score approaches the item's own
 * average.
 *
 * The score is in stars, but below the mean: with few ratings it can drop
 * under 1★, and with a weak prior and a large z even under 0. Only the order
 * matters for ranking.
 *
 * Edge cases:
 * - No ratings: N is the sum of alpha, never 0, so an unrated item scores
 *   the prior's mean minus its uncertainty (1.87 with the defaults).
 * - Cold start: that penalty puts a new item below items known to be
 *   mediocre (100 ratings of 2★ score 1.98). Gentler than Wilson's 0, but
 *   new items still need another way to get noticed.
 * - Mixed ratings (many 1★ and 5★) score below steady ratings with the same
 *   mean: their mean is less certain.
 */
export function dirichlet({
	alpha = [1, 1, 1, 1, 1],
	z = 1.96,
}: DirichletOptions = {}): Estimator {
	// Number.isFinite is false for NaN and Infinity, so both throw.
	if (!(Number.isFinite(z) && z > 0)) {
		throw new Error(`z must be greater than 0 and finite, got ${z}`);
	}

	// Every star level needs some pretend ratings, or the prior is invalid.
	if (!alpha.every((x) => Number.isFinite(x) && x > 0)) {
		throw new Error(
			`every alpha must be greater than 0 and finite, got [${alpha.join(", ")}]`,
		);
	}

	return (stats) => {
		const [n1, n2, n3, n4, n5] = stats.stars;

		// Posterior counts: pretend ratings plus real ones, level by level.
		const counts = [
			alpha[0] + n1,
			alpha[1] + n2,
			alpha[2] + n3,
			alpha[3] + n4,
			alpha[4] + n5,
		];

		const { total, weightedSum, sumOfSquares } = counts.reduce(
			(acc, count, i) => {
				// The star value of this level: index 0 is 1★.
				const value = i + 1;
				// N: all ratings, pretend and real. Never 0, since alpha > 0.
				acc.total += count;
				// Σ k·a_k, for E[S].
				acc.weightedSum += value * count;
				// Σ k²·a_k, for E[S²].
				acc.sumOfSquares += value ** 2 * count;
				return acc;
			},
			{ total: 0, weightedSum: 0, sumOfSquares: 0 },
		);

		// E[S]: the average star value, the best guess of the true mean.
		const mean = weightedSum / total;
		// E[S²]: the same average with each star value squared.
		const meanOfSquares = sumOfSquares / total;

		// Var[S]: the spread of the ratings, shrinking as N grows.
		const variance = (meanOfSquares - mean ** 2) / (total + 1);

		// Pessimistic score: z standard deviations below the mean.
		return mean - z * Math.sqrt(variance);
	};
}
