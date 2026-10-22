import type { StarShares } from "../types.ts";

/**
 * A simulated item's true star distribution: the share of buyers who would
 * give it 1★, 2★, 3★, 4★ and 5★. The simulation rolls fake reviews from it,
 * and its mean is the answer key the estimators are graded against.
 *
 * Each star level gets a weight from a bell curve centred on quality, and the
 * weights are divided by their total so the shares sum to 1:
 *
 *     weight_k = exp(-(k - quality)² / (2 · spread²))      k = 1..5
 *     share_k  = weight_k / (weight_1 + ... + weight_5)
 *
 * - quality: where the reviews centre, between 1 and 5. No item can truly
 *   average outside the star scale.
 * - spread: how much reviewers disagree, roughly how many stars a typical
 *   review lands from quality. At least 0.1 and finite: 0.3 means nearly
 *   every review is the same, 1.5 means opinions vary a lot.
 *
 * The result is five shares between 0 and 1 that sum to 1 (up to rounding).
 *
 * Edge cases:
 * - The scale stops at 1★ and 5★, so near the ends the bell is cut off and
 *   the true mean lands a little closer to 3 than quality (4.2 gives 4.12).
 * - The limits keep the weights from vanishing. Some star is always within
 *   0.5 of quality, and with spread >= 0.1 its weight is at least
 *   exp(-12.5), far above the smallest JavaScript number. Below that every
 *   weight could round to 0 and the shares would be 0 / 0 = NaN.
 */
export function trueDistribution(quality: number, spread: number): StarShares {
	// The range check rejects NaN and Infinity on its own.
	if (!(quality >= 1 && quality <= 5)) {
		throw new Error(`quality must be between 1 and 5, got ${quality}`);
	}

	// Number.isFinite is false for NaN and Infinity, so both throw.
	if (!(Number.isFinite(spread) && spread >= 0.1)) {
		throw new Error(`spread must be at least 0.1 and finite, got ${spread}`);
	}

	// Bell curve: 1 at quality, falling off with the squared distance. A larger
	// spread makes it fall off more slowly.
	const weight = (star: number) =>
		Math.exp(-((star - quality) ** 2) / (2 * spread ** 2));

	// One weight per star level. `as const` keeps it a 5-tuple, so each
	// weights[i] below is a number, not number | undefined.
	const weights = [
		weight(1),
		weight(2),
		weight(3),
		weight(4),
		weight(5),
	] as const;

	// Never 0: the nearest star level always has a real weight.
	const total = weights.reduce((sum, w) => sum + w, 0);

	// Shares: each weight as a fraction of the total, so they sum to 1.
	return [
		weights[0] / total,
		weights[1] / total,
		weights[2] / total,
		weights[3] / total,
		weights[4] / total,
	];
}

/**
 * The average rating a distribution produces: each star value times its
 * share, summed. For a true distribution this is the item's true mean, the
 * answer key for grading.
 *
 *     mean = 1·share_1 + 2·share_2 + 3·share_3 + 4·share_4 + 5·share_5
 *
 * The naive mean's formula, Σ k·n_k / Σ n_k, with shares in place of counts:
 * shares already sum to 1, so there is nothing to divide by.
 *
 * The result is in stars, between 1 and 5 for shares that sum to 1.
 */
export function trueMean(shares: StarShares): number {
	// i is the index, so i + 1 is the star value.
	return shares.reduce((sum, share, i) => sum + (i + 1) * share, 0);
}
