import { toThumbs } from "../toThumbs.ts";
import type { Estimator } from "../types.ts";

export interface WilsonOptions {
	/**
	 * How cautious the score is, as a z-score of the normal distribution.
	 *
	 * 1.96 builds a 95% two-sided interval (2.58: 99%). Only its lower end is
	 * used, so strictly that is 97.5% confidence the true up-ratio is at least
	 * the score. For ranking the exact level hardly matters: a larger z
	 * punishes items with few votes harder, a smaller z trusts them sooner.
	 *
	 * Must be greater than 0, or the factory throws: with z = 0 the interval
	 * has no width and the score is the raw up-ratio, where one 5★ scores 1.0.
	 */
	readonly z?: number;
}

/** 95% two-sided, the conventional default. */
export const zDefault = 1.96;

/**
 * Wilson score lower bound: how low the item's true up-ratio could plausibly
 * be, given its votes so far.
 *
 *             p̂ + z²/(2n) - z·√( p̂(1-p̂)/n + z²/(4n²) )
 *     lower = ------------------------------------------
 *                          1 + z²/n
 *
 * where n = up + down and p̂ = up / n.
 *
 * Votes come from star ratings via `toThumbs`: 4-5★ up, 1-2★ down, 3★ ignored.
 * That conversion is a demo shortcut so every estimator runs on one catalog;
 * real thumbs systems collect up and down votes directly.
 *
 * Pessimistic, not Bayesian: no prior and no pretend votes. Few votes widen
 * the interval and push the score down, where the Bayesian estimators pull it
 * toward the catalog average. With only up votes the formula collapses to
 * n / (n + z²), as if every item had z² pretend down votes.
 *
 * An item with no votes (or only 3★ ratings) scores 0, the bottom: Wilson's
 * cold-start weakness. The score is a share between 0 and 1, not stars:
 * compare rankings across estimators, not raw scores.
 */
export function wilson({ z = zDefault }: WilsonOptions = {}): Estimator {
	// !(z > 0) also rejects NaN, which `z <= 0` would let through.
	if (!(z > 0)) {
		throw new Error(`z must be greater than 0, got ${z}`);
	}

	return (stats) => {
		const { up, down } = toThumbs(stats.stars);

		const n = up + down;

		// No votes: p̂ would be 0 / 0 = NaN, which breaks sorting.
		if (n === 0) {
			return 0;
		}

		// Observed up-ratio.
		const p = up / n;

		// The interval's midpoint: p̂ nudged toward 0.5, more so with few votes.
		const centre = p + z ** 2 / (2 * n);
		// Half the interval's width; shrinks as n grows.
		const margin = z * Math.sqrt((p * (1 - p)) / n + z ** 2 / (4 * n ** 2));
		// Rescales the result back into 0..1.
		const denominator = 1 + z ** 2 / n;

		return (centre - margin) / denominator;
	};
}
