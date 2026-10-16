import { describe, expect, it } from "vitest";
import { bayesianAverage } from "../../src/estimators/bayesianAverage.ts";
import type { ItemStats, StarCounts } from "../../src/types.ts";

const stats = (stars: StarCounts): ItemStats => ({ itemId: "1", stars });

describe("bayesianAverage", () => {
	// 10 pretend ratings of 4★: score = (40 + sum of ratings) / (10 + n)
	const score = bayesianAverage({ m: 10, c: 4 });

	const cases: { name: string; stars: StarCounts; expected: number }[] = [
		{ name: "no ratings", stars: [0, 0, 0, 0, 0], expected: 40 / 10 },
		{ name: "a single 5★", stars: [0, 0, 0, 0, 1], expected: (40 + 5) / 11 },
		{ name: "a single 1★", stars: [1, 0, 0, 0, 0], expected: (40 + 1) / 11 },
		{ name: "five 5★", stars: [0, 0, 0, 0, 5], expected: (40 + 25) / 15 },
		{ name: "ten 3★", stars: [0, 0, 10, 0, 0], expected: (40 + 30) / 20 },
		{
			name: "500 ratings",
			stars: [5, 5, 10, 95, 385],
			expected: (40 + 2350) / 510,
		},
	];

	it.each(cases)("scores $name as $expected", ({ stars, expected }) => {
		expect(score(stats(stars))).toBeCloseTo(expected, 5);
	});

	it("scores an item with no ratings as c, whatever c is", () => {
		const custom = bayesianAverage({ m: 7, c: 3.5 });

		expect(custom(stats([0, 0, 0, 0, 0]))).toBe(3.5);
	});

	it("lands between c and the item's own mean", () => {
		// own mean 5, c = 4
		const highScore = score(stats([0, 0, 0, 0, 1]));
		expect(highScore).toBeGreaterThan(4);
		expect(highScore).toBeLessThan(5);

		// own mean 1, c = 4
		const lowScore = score(stats([1, 0, 0, 0, 0]));
		expect(lowScore).toBeGreaterThan(1);
		expect(lowScore).toBeLessThan(4);
	});

	it("approaches the item's own mean as ratings pile up", () => {
		// 10,000 × 5★: (40 + 50000) / 10010 ≈ 4.999
		expect(score(stats([0, 0, 0, 0, 10_000]))).toBeCloseTo(5, 2);
	});

	it("pulls harder toward c when m is larger", () => {
		const single5 = stats([0, 0, 0, 0, 1]);
		const lenient = bayesianAverage({ m: 1, c: 4 })(single5); // 4.5
		const strict = bayesianAverage({ m: 100, c: 4 })(single5); // ≈ 4.01

		expect(strict - 4).toBeLessThan(lenient - 4);
	});

	// The case the naive mean gets wrong (see naiveMean.test.ts, `it.fails`).
	it("ranks 500 ratings averaging 4.7 above a single 5★ rating", () => {
		const single = stats([0, 0, 0, 0, 1]);
		const many = stats([5, 5, 10, 95, 385]);

		expect(score(many)).toBeGreaterThan(score(single));
	});

	it.each([0, -1, Number.NaN])("throws when m is %s", (m) => {
		expect(() => bayesianAverage({ m, c: 4 })).toThrow(
			"m must be greater than 0",
		);
	});
});
