import { describe, expect, it } from "vitest";
import { wilson } from "../../src/estimators/wilson.ts";
import type { ItemStats, StarCounts } from "../../src/types.ts";

const stats = (stars: StarCounts): ItemStats => ({ itemId: "1", stars });

describe("wilson", () => {
	// Default z = 1.96 (95%).
	const score = wilson();
	const z2 = 1.96 ** 2;

	// Exact values: with only up votes the formula collapses to n / (n + z²),
	// with only down votes to 0.
	const exact: { name: string; stars: StarCounts; expected: number }[] = [
		{ name: "no ratings", stars: [0, 0, 0, 0, 0], expected: 0 },
		// 3★ is ignored by toThumbs, so seven ratings still mean zero votes.
		{ name: "only 3★", stars: [0, 0, 7, 0, 0], expected: 0 },
		{ name: "only down votes", stars: [1, 1, 0, 0, 0], expected: 0 },
		{ name: "a single 5★", stars: [0, 0, 0, 0, 1], expected: 1 / (1 + z2) },
		{ name: "ten 5★", stars: [0, 0, 0, 0, 10], expected: 10 / (10 + z2) },
	];

	it.each(exact)("scores $name as $expected", ({ stars, expected }) => {
		expect(score(stats(stars))).toBeCloseTo(expected, 5);
	});

	// No closed form for mixed votes: values computed separately and rounded
	// to 3 decimals, so the assertion only checks 3 digits.
	const rounded: { name: string; stars: StarCounts; expected: number }[] = [
		{ name: "2 up, 2 down", stars: [1, 1, 0, 1, 1], expected: 0.15 },
		{ name: "9 up, 1 down", stars: [1, 0, 0, 0, 9], expected: 0.596 },
		{
			name: "500 ratings (480 up, 10 down)",
			stars: [5, 5, 10, 95, 385],
			expected: 0.963,
		},
	];

	it.each(rounded)("scores $name as about $expected", ({ stars, expected }) => {
		expect(score(stats(stars))).toBeCloseTo(expected, 3);
	});

	it("uses z = 1.96 when no options are given", () => {
		const single5 = stats([0, 0, 0, 0, 1]);

		expect(wilson()(single5)).toBe(wilson({ z: 1.96 })(single5));
	});

	it("stays below the item's own up-ratio", () => {
		// all up: own ratio 1
		expect(score(stats([0, 0, 0, 0, 1]))).toBeLessThan(1);
		// 9 of 10 up: own ratio 0.9
		expect(score(stats([1, 0, 0, 0, 9]))).toBeLessThan(0.9);
	});

	it("approaches the item's own up-ratio as votes pile up", () => {
		// 10,000 up, 0 down: 10000 / (10000 + z²) ≈ 0.9996
		expect(score(stats([0, 0, 0, 0, 10_000]))).toBeCloseTo(1, 3);
	});

	it("is more pessimistic with a larger z", () => {
		const single5 = stats([0, 0, 0, 0, 1]);
		const lenient = wilson({ z: 1 })(single5); // 1 / 2 = 0.5
		const strict = wilson({ z: 3 })(single5); // 1 / 10 = 0.1

		expect(strict).toBeLessThan(lenient);
	});

	// The case the naive mean gets wrong (see naiveMean.test.ts, `it.fails`).
	it("ranks 500 ratings averaging 4.7 above a single 5★ rating", () => {
		const single = stats([0, 0, 0, 0, 1]);
		const many = stats([5, 5, 10, 95, 385]);

		expect(score(many)).toBeGreaterThan(score(single));
	});

	// The cold-start weakness: the Bayesian estimators start a new item at the
	// prior, Wilson puts it at the very bottom, tied with an all-negative item.
	it("scores an unrated item 0, the same as a single 1★", () => {
		const unrated = score(stats([0, 0, 0, 0, 0]));
		const single1 = score(stats([1, 0, 0, 0, 0]));

		expect(unrated).toBe(0);
		expect(single1).toBe(0);
	});

	it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
		"throws when z is %s",
		(z) => {
			expect(() => wilson({ z })).toThrow(
				"z must be greater than 0 and finite",
			);
		},
	);
});
