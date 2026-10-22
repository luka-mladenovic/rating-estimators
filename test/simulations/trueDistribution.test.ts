import { describe, expect, it } from "vitest";
import {
	trueDistribution,
	trueMean,
} from "../../src/simulations/trueDistribution.ts";
import type { StarShares } from "../../src/types.ts";

const sum = (shares: StarShares) => shares.reduce((total, s) => total + s, 0);

describe("trueMean", () => {
	const exact: { name: string; shares: StarShares; expected: number }[] = [
		{ name: "all 1★", shares: [1, 0, 0, 0, 0], expected: 1 },
		{ name: "all 5★", shares: [0, 0, 0, 0, 1], expected: 5 },
		{ name: "even shares", shares: [0.2, 0.2, 0.2, 0.2, 0.2], expected: 3 },
		{
			name: "half 4★, half 5★",
			shares: [0, 0, 0, 0.5, 0.5],
			expected: 4 * 0.5 + 5 * 0.5,
		},
		// Same mean as above from a different recipe: noisier reviews.
		{
			name: "a quarter 3★, three quarters 5★",
			shares: [0, 0, 0.25, 0, 0.75],
			expected: 3 * 0.25 + 5 * 0.75,
		},
		{
			name: "a mixed distribution",
			shares: [0.05, 0.05, 0.1, 0.3, 0.5],
			expected: 1 * 0.05 + 2 * 0.05 + 3 * 0.1 + 4 * 0.3 + 5 * 0.5,
		},
	];

	it.each(exact)("gives $name a mean of $expected", ({ shares, expected }) => {
		expect(trueMean(shares)).toBeCloseTo(expected, 5);
	});
});

describe("trueDistribution", () => {
	// Exact values: the weights are exp(-(k - quality)² / (2 · spread²)),
	// divided by their total.
	const e05 = Math.exp(-0.5);
	const e2 = Math.exp(-2);
	const e45 = Math.exp(-4.5);
	// quality 3, spread 1: weights e^-2, e^-0.5, 1, e^-0.5, e^-2
	const t3 = 1 + 2 * e05 + 2 * e2;
	// quality 4, spread 1: weights e^-4.5, e^-2, e^-0.5, 1, e^-0.5
	const t4 = e45 + e2 + 2 * e05 + 1;

	const exact: {
		name: string;
		quality: number;
		spread: number;
		expected: StarShares;
	}[] = [
		{
			name: "quality 3, spread 1",
			quality: 3,
			spread: 1,
			expected: [e2 / t3, e05 / t3, 1 / t3, e05 / t3, e2 / t3],
		},
		{
			name: "quality 4, spread 1",
			quality: 4,
			spread: 1,
			expected: [e45 / t4, e2 / t4, e05 / t4, 1 / t4, e05 / t4],
		},
		// The smallest spread at the ends of the scale: everything on one star.
		{
			name: "quality 1, spread 0.1",
			quality: 1,
			spread: 0.1,
			expected: [1, 0, 0, 0, 0],
		},
		{
			name: "quality 5, spread 0.1",
			quality: 5,
			spread: 0.1,
			expected: [0, 0, 0, 0, 1],
		},
		// Halfway between two stars with the smallest spread: split evenly.
		// With a smaller spread every weight could round to 0 (see the doc
		// comment), which is why spread must be at least 0.1.
		{
			name: "quality 1.5, spread 0.1",
			quality: 1.5,
			spread: 0.1,
			expected: [0.5, 0.5, 0, 0, 0],
		},
	];

	it.each(exact)(
		"gives $name as $expected",
		({ quality, spread, expected }) => {
			const shares = trueDistribution(quality, spread);

			expected.forEach((share, i) => {
				expect(shares[i]).toBeCloseTo(share, 5);
			});
		},
	);

	// Values computed separately and rounded to 3 decimals, so the assertion
	// only checks 3 digits.
	const rounded: {
		name: string;
		quality: number;
		spread: number;
		expected: StarShares;
	}[] = [
		{
			name: "quality 4.2, spread 0.8",
			quality: 4.2,
			spread: 0.8,
			expected: [0, 0.012, 0.169, 0.504, 0.315],
		},
		{
			name: "quality 4.2, spread 1.5",
			quality: 4.2,
			spread: 1.5,
			expected: [0.034, 0.113, 0.24, 0.327, 0.286],
		},
		{
			name: "quality 2.5, spread 0.7",
			quality: 2.5,
			spread: 0.7,
			expected: [0.057, 0.442, 0.442, 0.057, 0.001],
		},
	];

	it.each(rounded)(
		"gives $name as about $expected",
		({ quality, spread, expected }) => {
			const shares = trueDistribution(quality, spread);

			expected.forEach((share, i) => {
				expect(shares[i]).toBeCloseTo(share, 3);
			});
		},
	);

	// A spread of qualities and spreads, including both ends of each range.
	const grid = [1, 1.7, 3, 4.2, 5].flatMap((quality) =>
		[0.1, 0.6, 1, 1.4, 3].map((spread) => ({ quality, spread })),
	);

	it.each(grid)(
		"gives shares between 0 and 1 that sum to 1 (quality $quality, spread $spread)",
		({ quality, spread }) => {
			const shares = trueDistribution(quality, spread);

			for (const share of shares) {
				expect(share).toBeGreaterThanOrEqual(0);
				expect(share).toBeLessThanOrEqual(1);
			}
			// Floating-point rounding can leave it at 0.9999999999999999.
			expect(sum(shares)).toBeCloseTo(1, 10);
		},
	);

	it("is symmetric around 3★", () => {
		const shares = trueDistribution(3, 0.8);

		expect(shares[0]).toBeCloseTo(shares[4], 10);
		expect(shares[1]).toBeCloseTo(shares[3], 10);
		expect(trueMean(shares)).toBeCloseTo(3, 10);
	});

	it("mirrors quality q and 6 - q", () => {
		const low = trueDistribution(2, 1);
		const high = trueDistribution(4, 1);

		expect([...low].reverse()).toEqual(
			high.map((share) => expect.closeTo(share, 10)),
		);
	});

	it("gives a higher mean for a higher quality", () => {
		const means = [1, 2, 3, 4, 5].map((quality) =>
			trueMean(trueDistribution(quality, 1)),
		);

		for (let i = 1; i < means.length; i++) {
			expect(means[i]).toBeGreaterThan(means[i - 1] ?? Number.NaN);
		}
	});

	it("puts less on the centre star and more on far stars with a larger spread", () => {
		const narrow = trueDistribution(4, 0.5);
		const wide = trueDistribution(4, 1.5);

		// The centre, 4★, loses share.
		expect(wide[3]).toBeLessThan(narrow[3]);
		// The far end, 1★, gains share.
		expect(wide[0]).toBeGreaterThan(narrow[0]);
	});

	// Accepted behaviour: the scale stops at 1★ and 5★, so near the ends the
	// bell is cut off and the true mean is pulled toward 3. The simulation
	// grades against the mean of the shares, not quality.
	it("has a true mean a little closer to 3 than quality near the ends", () => {
		expect(trueMean(trueDistribution(4.2, 0.8))).toBeCloseTo(4.122, 3);
		expect(trueMean(trueDistribution(5, 1))).toBeLessThan(5);
		expect(trueMean(trueDistribution(1, 1))).toBeGreaterThan(1);
	});

	it.each([
		0.99,
		5.01,
		0,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
	])("throws when quality is %s", (quality) => {
		expect(() => trueDistribution(quality, 1)).toThrow(
			"quality must be between 1 and 5",
		);
	});

	it.each([0.09, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
		"throws when spread is %s",
		(spread) => {
			expect(() => trueDistribution(3, spread)).toThrow(
				"spread must be at least 0.1 and finite",
			);
		},
	);
});
