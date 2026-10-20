import { describe, expect, it } from "vitest";
import { dirichlet } from "../../src/estimators/dirichlet.ts";
import type { ItemStats, StarCounts } from "../../src/types.ts";

const stats = (stars: StarCounts): ItemStats => ({ itemId: "1", stars });

describe("dirichlet", () => {
	// Defaults: alpha = [1, 1, 1, 1, 1], z = 1.96.
	const score = dirichlet({});
	const z = 1.96;

	// Exact values, worked out by hand from a = alpha + counts:
	//   mean = Σ k·a / N, meanOfSquares = Σ k²·a / N,
	//   variance = (meanOfSquares - mean²) / (N + 1)
	const exact: { name: string; stars: StarCounts; expected: number }[] = [
		// a = [1, 1, 1, 1, 1], N = 5: mean 3, meanOfSquares 11, variance 2 / 6
		{
			name: "no ratings",
			stars: [0, 0, 0, 0, 0],
			expected: 3 - z * Math.sqrt(1 / 3),
		},
		// a = [1, 1, 1, 1, 2], N = 6: mean 10 / 3, meanOfSquares 40 / 3,
		// variance (40 / 3 - 100 / 9) / 7 = 20 / 63
		{
			name: "a single 5★",
			stars: [0, 0, 0, 0, 1],
			expected: 10 / 3 - z * Math.sqrt(20 / 63),
		},
		// a = [2, 1, 1, 1, 1], N = 6: mean 8 / 3, meanOfSquares 28 / 3,
		// variance (28 / 3 - 64 / 9) / 7 = 20 / 63
		{
			name: "a single 1★",
			stars: [1, 0, 0, 0, 0],
			expected: 8 / 3 - z * Math.sqrt(20 / 63),
		},
		// a = [1, 1, 1, 1, 6], N = 10: mean 4, meanOfSquares 18, variance 2 / 11
		{
			name: "five 5★",
			stars: [0, 0, 0, 0, 5],
			expected: 4 - z * Math.sqrt(2 / 11),
		},
	];

	it.each(exact)("scores $name as $expected", ({ stars, expected }) => {
		expect(score(stats(stars))).toBeCloseTo(expected, 5);
	});

	// Larger counts: values computed separately and rounded to 3 decimals, so
	// the assertion only checks 3 digits.
	const rounded: { name: string; stars: StarCounts; expected: number }[] = [
		{ name: "a mixed sample", stars: [2, 0, 1, 10, 40], expected: 4.222 },
		{ name: "100 ratings of 2★", stars: [0, 100, 0, 0, 0], expected: 1.976 },
		{
			name: "500 ratings averaging 4.7",
			stars: [5, 5, 10, 95, 385],
			expected: 4.623,
		},
	];

	it.each(rounded)("scores $name as about $expected", ({ stars, expected }) => {
		expect(score(stats(stars))).toBeCloseTo(expected, 3);
	});

	it("uses alpha = [1, 1, 1, 1, 1] and z = 1.96 when no options are given", () => {
		const single5 = stats([0, 0, 0, 0, 1]);

		expect(score(single5)).toBe(
			dirichlet({ alpha: [1, 1, 1, 1, 1], z: 1.96 })(single5),
		);
	});

	it("approaches the item's own average as ratings pile up", () => {
		// 10,000 ratings of 4★: the prior and the penalty are both tiny.
		expect(score(stats([0, 0, 0, 10_000, 0]))).toBeCloseTo(4, 2);
	});

	it("is more pessimistic with a larger z", () => {
		const single5 = stats([0, 0, 0, 0, 1]);
		const lenient = dirichlet({ z: 1 })(single5);
		const strict = dirichlet({ z: 3 })(single5);

		expect(strict).toBeLessThan(lenient);
	});

	it("pulls harder toward the prior with more pretend ratings", () => {
		const fiveFives = stats([0, 0, 0, 0, 5]);
		// a = [2, 2, 2, 2, 7], N = 15: mean 11 / 3, meanOfSquares 47 / 3,
		// variance (47 / 3 - 121 / 9) / 16 = 5 / 36
		const strong = dirichlet({ alpha: [2, 2, 2, 2, 2] })(fiveFives);

		expect(strong).toBeCloseTo(11 / 3 - z * Math.sqrt(5 / 36), 5);
		expect(strong).toBeLessThan(score(fiveFives));
	});

	it("starts a new item where the shape of alpha puts it", () => {
		const unrated = stats([0, 0, 0, 0, 0]);
		// Catalog-shaped prior: N = 10, mean 41.5 / 10 = 4.15,
		// meanOfSquares 184.5 / 10 = 18.45, variance (18.45 - 4.15²) / 11
		const catalog = dirichlet({ alpha: [0.5, 0.5, 1, 3, 5] })(unrated);

		expect(catalog).toBeCloseTo(
			4.15 - z * Math.sqrt((18.45 - 4.15 ** 2) / 11),
			5,
		);
		expect(catalog).toBeGreaterThan(score(unrated));
	});

	// The case the naive mean gets wrong (see naiveMean.test.ts, `it.fails`).
	it("ranks 500 ratings averaging 4.7 above a single 5★ rating", () => {
		const single = stats([0, 0, 0, 0, 1]);
		const many = stats([5, 5, 10, 95, 385]);

		expect(score(many)).toBeGreaterThan(score(single));
	});

	// The case the minimum count gets wrong (see minimumCount.test.ts).
	it("ranks 500 ratings averaging 4.7 above five 5★ ratings", () => {
		const five = stats([0, 0, 0, 0, 5]);
		const many = stats([5, 5, 10, 95, 385]);

		expect(score(many)).toBeGreaterThan(score(five));
	});

	// Accepted behaviour, the cold-start cost of being pessimistic: an unrated
	// item (mean 3) ranks below an item known to be 2★, because its mean is
	// so uncertain. Gentler than Wilson, which scores it 0.
	it("ranks an unrated item below 100 ratings of 2★", () => {
		const unrated = score(stats([0, 0, 0, 0, 0]));
		const twos = score(stats([0, 100, 0, 0, 0]));

		expect(unrated).toBeLessThan(twos);
	});

	// Accepted behaviour: with the same mean (3) and count, ratings split
	// between 1★ and 5★ leave the true mean less certain than steady 3★
	// ratings, so they score lower (about 2.624 against 2.941).
	it("scores mixed 1★ and 5★ below steady 3★ with the same mean", () => {
		const mixed = score(stats([50, 0, 0, 0, 50]));
		const steady = score(stats([0, 0, 100, 0, 0]));

		expect(mixed).toBeLessThan(steady);
	});

	// Accepted behaviour: the score is mean minus a penalty, so with a weak
	// prior and a large z it can fall off the star scale. Only order matters.
	it("can score below 0 with a weak prior and a large z", () => {
		const weak = dirichlet({ alpha: [0.01, 0.01, 0.01, 0.01, 0.01], z: 3 });

		expect(weak(stats([0, 0, 0, 0, 0]))).toBeLessThan(0);
	});

	it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
		"throws when z is %s",
		(z) => {
			expect(() => dirichlet({ z })).toThrow(
				"z must be greater than 0 and finite",
			);
		},
	);

	it.each<{ alpha: [number, number, number, number, number] }>([
		{ alpha: [0, 1, 1, 1, 1] },
		{ alpha: [1, 1, 1, 1, -1] },
		{ alpha: [1, Number.NaN, 1, 1, 1] },
		{ alpha: [1, 1, Number.POSITIVE_INFINITY, 1, 1] },
	])("throws when alpha is $alpha", ({ alpha }) => {
		expect(() => dirichlet({ alpha })).toThrow(
			"every alpha must be greater than 0 and finite",
		);
	});
});
