import { toThumbs } from "../toThumbs.ts";
import type { Estimator } from "../types.ts";

export interface BetaBinomialOptions {
	/**
	 * How many pretend up votes every item starts with.
	 *
	 * Together with `beta` it sets where a new item starts and how much
	 * evidence it needs. Pick a prior up-ratio μ (usually the catalog's overall
	 * share of up votes) and a strength m (pretend votes in total), then
	 * alpha = m * μ and beta = m * (1 - μ). With m = 10 and μ = 0.8:
	 * alpha = 8, beta = 2.
	 *
	 * Must be greater than 0, or the factory throws.
	 */
	readonly alpha: number;

	/**
	 * How many pretend down votes every item starts with. See `alpha`.
	 *
	 * Must be greater than 0, or the factory throws.
	 */
	readonly beta: number;
}

/**
 * Beta-Binomial posterior mean: the share of up votes, counting alpha pretend
 * ups and beta pretend downs on top of the item's real votes.
 *
 *     score = (alpha + up) / (alpha + beta + up + down)
 *
 * Votes come from star ratings via `toThumbs`: 4-5★ up, 1-2★ down, 3★ ignored.
 * The thumbs version of the Bayesian average: alpha / (alpha + beta) plays
 * the role of c, and alpha + beta the role of m.
 *
 * A new item (or one with only 3★ ratings) scores alpha / (alpha + beta); as
 * votes come in, the score moves toward the item's own up / (up + down).
 *
 * The score is a share between 0 and 1, not stars: compare rankings across
 * estimators, not raw scores.
 */
export function betaBinomial({ alpha, beta }: BetaBinomialOptions): Estimator {
	// !(x > 0) also rejects NaN, which `x <= 0` would let through.
	if (!(alpha > 0) || !(beta > 0)) {
		throw new Error(
			`alpha and beta must be greater than 0, got alpha ${alpha}, beta ${beta}`,
		);
	}

	return (stats) => {
		const { up, down } = toThumbs(stats.stars);
		return (alpha + up) / (alpha + beta + up + down);
	};
}
