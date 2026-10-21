/**
 * Kendall tau: how closely two orderings of the same items agree.
 *
 * x and y are parallel: position i in both is the same item. In the
 * simulation x holds the true means and y one estimator's scores. Only the
 * order matters, so scores can be passed in directly, with no ranking or
 * sorting first.
 *
 * Every pair of items is compared once:
 *
 *     concordant (C)  x and y agree on which item is better
 *     discordant (D)  x and y disagree
 *     tied in x (Tx)  x scores them equal, y doesn't
 *     tied in y (Ty)  y scores them equal, x doesn't
 *     tied in both    left out of C, D, Tx and Ty
 *
 *                C - D
 *     tau_a = ───────────        all pairs = n·(n - 1) / 2
 *             all pairs
 *
 *                       C - D
 *     tau_b = ──────────────────────────────
 *             √((C + D + Tx) · (C + D + Ty))
 *
 * Both run from 1 (same order) through 0 (no better than random) to -1
 * (reversed).
 *
 * - a (tau-a) is the headline: a tied pair earns nothing but still counts.
 *   It equals the expected tau of the list a user sees, where tied items
 *   end up in some arbitrary order.
 * - b (tau-b) is the standard version, which forgives ties. The gap between
 *   a and b shows how much an estimator leans on ties.
 *
 * Edge cases:
 * - x and y of different lengths, or fewer than 2 items: throws. There are
 *   no pairs to compare, or the items don't line up.
 * - NaN or Infinity anywhere: throws. Math.sign would return NaN and the
 *   pair would silently count as tied in both.
 * - Every pair tied on one side (e.g. an estimator that scores everything
 *   0): the orderings share no information, so a and b are both 0. Tau-b
 *   would otherwise be 0 / 0.
 */
export function kendallTau(
	x: readonly number[],
	y: readonly number[],
): { a: number; b: number } {
	// Position i must be the same item in both, so the lengths must match.
	if (!(x.length === y.length)) {
		throw new Error(
			`x and y must have the same length, got ${x.length} and ${y.length}`,
		);
	}

	// With fewer than 2 items there are no pairs, and tau-a would be 0 / 0.
	if (!(x.length >= 2)) {
		throw new Error(`need at least 2 items, got ${x.length}`);
	}

	// Number.isFinite is false for NaN and Infinity, so both throw.
	for (const [name, values] of [
		["x", x],
		["y", y],
	] as const) {
		const index = values.findIndex((value) => !Number.isFinite(value));
		if (!(index === -1)) {
			throw new Error(
				`every ${name} must be finite, got ${values[index]} at index ${index}`,
			);
		}
	}

	// Pair counters, one per kind of pair.
	let c = 0;
	let d = 0;
	let tx = 0;
	let ty = 0;
	let pairs = 0;

	// Visit each pair once: j starts after i, so (i, j) never repeats as
	// (j, i) and an item is never paired with itself.
	for (let i = 0; i < x.length; i++) {
		for (let j = i + 1; j < x.length; j++) {
			const xi = x[i];
			const xj = x[j];
			const yi = y[i];
			const yj = y[j];

			// Never true inside the loop bounds, but noUncheckedIndexedAccess
			// types x[i] as number | undefined, so TypeScript needs the check.
			if (
				xi === undefined ||
				xj === undefined ||
				yi === undefined ||
				yj === undefined
			) {
				throw new Error(`no value at index ${i} or ${j}`);
			}

			// Which item each side puts higher: 1 for i, -1 for j, 0 for a tie.
			const sx = Math.sign(xi - xj);
			const sy = Math.sign(yi - yj);

			// Same sign gives 1, opposite signs -1, and any tie 0.
			const product = sx * sy;

			if (product === 1) {
				c++; // Concordant
			} else if (product === -1) {
				d++; // Discordant
			} else if (sx === 0 && sy !== 0) {
				tx++; // Tied in x
			} else if (sy === 0 && sx !== 0) {
				ty++; // Tied in y
			}

			pairs++;
		}
	}

	// Tau-a: agreements minus disagreements, as a share of all pairs.
	const a = (c - d) / pairs;
	// Tau-b: the same difference, scaled by the pairs each side doesn't tie.
	// The denominator is 0 when one side ties every pair: return 0, like a.
	const denominator = (c + d + tx) * (c + d + ty);
	const b = denominator === 0 ? 0 : (c - d) / Math.sqrt(denominator);

	return {
		a,
		b,
	};
}
