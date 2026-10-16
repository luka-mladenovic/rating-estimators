import { describe, expect, it } from "vitest";
import { naiveMean } from "../../src/estimators/naiveMean.ts";
import type { ItemStats, StarCounts } from "../../src/types.ts";

const stats = (stars: StarCounts): ItemStats => ({ itemId: "1", stars });

describe("naiveMean", () => {
	const cases: { name: string; stars: StarCounts; expected: number }[] = [
		{ name: "a single 1★", stars: [1, 0, 0, 0, 0], expected: 1 },
		{ name: "a single 5★", stars: [0, 0, 0, 0, 1], expected: 5 },
		{ name: "only 3★", stars: [0, 0, 4, 0, 0], expected: 3 },
		{ name: "one of each", stars: [1, 1, 1, 1, 1], expected: 15 / 5 },
		{ name: "polarised 1★ and 5★", stars: [1, 0, 0, 0, 1], expected: 6 / 2 },
		{ name: "one 4★ and two 5★", stars: [0, 0, 0, 1, 2], expected: 14 / 3 },
		{ name: "a mixed sample", stars: [2, 0, 1, 10, 40], expected: 245 / 53 },
		{ name: "500 ratings", stars: [5, 5, 10, 95, 385], expected: 2350 / 500 },
	];

	it.each(cases)("averages $name to $expected", ({ stars, expected }) => {
		expect(naiveMean(stats(stars))).toBeCloseTo(expected, 5);
	});

	it("returns zero with no ratings", () => {
		expect(naiveMean(stats([0, 0, 0, 0, 0]))).toBe(0);
	});

	// Known limitation, kept as a test: the naive mean ignores how many ratings
	// an item has, so a single 5★ (5.0) outranks 500 ratings averaging 4.7.
	// `it.fails` passes while the expectation below fails. Estimators that
	// account for sample size (e.g. the Bayesian average) should pass it as a
	// plain `it`.
	it.fails("ranks 500 ratings averaging 4.7 above a single 5★ rating", () => {
		const single = stats([0, 0, 0, 0, 1]);
		const many = stats([5, 5, 10, 95, 385]);

		expect(naiveMean(many)).toBeGreaterThan(naiveMean(single));
	});
});
