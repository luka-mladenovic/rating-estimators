import { describe, expect, it } from "vitest";
import { minimumCount } from "../../src/estimators/minimumCount.ts";
import { naiveMean } from "../../src/estimators/naiveMean.ts";
import type { ItemStats, StarCounts } from "../../src/types.ts";

const stats = (stars: StarCounts): ItemStats => ({ itemId: "1", stars });

describe("minimumCount", () => {
	// Items need at least 5 ratings; below that they score 0.
	const score = minimumCount({ n: 5 });

	const cases: { name: string; stars: StarCounts; expected: number }[] = [
		{ name: "no ratings", stars: [0, 0, 0, 0, 0], expected: 0 },
		{ name: "a single 5★", stars: [0, 0, 0, 0, 1], expected: 0 },
		{ name: "four 5★, one short", stars: [0, 0, 0, 0, 4], expected: 0 },
		{ name: "five 5★, exactly at", stars: [0, 0, 0, 0, 5], expected: 25 / 5 },
		{ name: "one of each", stars: [1, 1, 1, 1, 1], expected: 15 / 5 },
		{ name: "a mixed sample", stars: [2, 0, 1, 10, 40], expected: 245 / 53 },
		{ name: "500 ratings", stars: [5, 5, 10, 95, 385], expected: 2350 / 500 },
	];

	it.each(cases)("scores $name as $expected", ({ stars, expected }) => {
		expect(score(stats(stars))).toBeCloseTo(expected, 5);
	});

	it("is the naive mean when the threshold is 1", () => {
		const noThreshold = minimumCount({ n: 1 });

		for (const { stars } of cases) {
			expect(noThreshold(stats(stars))).toBe(naiveMean(stats(stars)));
		}
	});

	// The cliff: one rating short of the threshold, a perfect item ranks below
	// an item that is all 1★. One more rating and it jumps to the top.
	it("ranks four 5★ below five 1★", () => {
		const fourFives = score(stats([0, 0, 0, 0, 4]));
		const fiveOnes = score(stats([5, 0, 0, 0, 0]));

		expect(fourFives).toBeLessThan(fiveOnes);
	});

	// The case the naive mean gets wrong (see naiveMean.test.ts, `it.fails`):
	// the threshold fixes it, because a single rating doesn't count.
	it("ranks 500 ratings averaging 4.7 above a single 5★ rating", () => {
		const single = stats([0, 0, 0, 0, 1]);
		const many = stats([5, 5, 10, 95, 385]);

		expect(score(many)).toBeGreaterThan(score(single));
	});

	// Known limitation, kept as a test: above the threshold it is still the
	// naive mean, so the same problem returns at n ratings instead of 1.
	// Five 5★ (5.0) outrank 500 ratings averaging 4.7.
	it.fails("ranks 500 ratings averaging 4.7 above five 5★ ratings", () => {
		const five = stats([0, 0, 0, 0, 5]);
		const many = stats([5, 5, 10, 95, 385]);

		expect(score(many)).toBeGreaterThan(score(five));
	});

	it.each([0, 0.5, -1, Number.NaN])("throws when n is %s", (n) => {
		expect(() => minimumCount({ n })).toThrow("n must be at least 1");
	});
});
