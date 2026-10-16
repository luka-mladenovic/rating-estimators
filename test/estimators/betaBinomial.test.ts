import { describe, expect, it } from "vitest";
import { betaBinomial } from "../../src/estimators/betaBinomial.ts";
import type { ItemStats, StarCounts } from "../../src/types.ts";

const stats = (stars: StarCounts): ItemStats => ({ itemId: "1", stars });

describe("betaBinomial", () => {
	// 8 pretend ups and 2 pretend downs: score = (8 + up) / (10 + up + down)
	const score = betaBinomial({ alpha: 8, beta: 2 });

	const cases: { name: string; stars: StarCounts; expected: number }[] = [
		{ name: "no ratings", stars: [0, 0, 0, 0, 0], expected: 8 / 10 },
		// 3★ is ignored by toThumbs, so seven ratings still mean zero votes.
		{ name: "only 3★", stars: [0, 0, 7, 0, 0], expected: 8 / 10 },
		{ name: "a single 5★", stars: [0, 0, 0, 0, 1], expected: (8 + 1) / 11 },
		{ name: "a single 1★", stars: [1, 0, 0, 0, 0], expected: 8 / 11 },
		{ name: "one of each", stars: [1, 1, 1, 1, 1], expected: (8 + 2) / 14 },
		{
			name: "500 ratings (480 up, 10 down)",
			stars: [5, 5, 10, 95, 385],
			expected: (8 + 480) / 500,
		},
	];

	it.each(cases)("scores $name as $expected", ({ stars, expected }) => {
		expect(score(stats(stars))).toBeCloseTo(expected, 5);
	});

	it("scores an item with no votes as alpha / (alpha + beta)", () => {
		const custom = betaBinomial({ alpha: 3, beta: 7 });

		expect(custom(stats([0, 0, 0, 0, 0]))).toBeCloseTo(0.3, 5);
	});

	it("lands between the prior and the item's own up-ratio", () => {
		// all up: own ratio 1, prior 0.8
		const allUp = score(stats([0, 0, 0, 0, 1]));
		expect(allUp).toBeGreaterThan(0.8);
		expect(allUp).toBeLessThan(1);

		// all down: own ratio 0, prior 0.8
		const allDown = score(stats([1, 0, 0, 0, 0]));
		expect(allDown).toBeGreaterThan(0);
		expect(allDown).toBeLessThan(0.8);
	});

	it("approaches the item's own up-ratio as votes pile up", () => {
		// 10,000 up, 0 down: (8 + 10000) / 10010 ≈ 0.9998
		expect(score(stats([0, 0, 0, 0, 10_000]))).toBeCloseTo(1, 3);
	});

	it("pulls harder toward the prior with more pretend votes", () => {
		const single5 = stats([0, 0, 0, 0, 1]);
		const lenient = betaBinomial({ alpha: 0.8, beta: 0.2 })(single5); // 0.9
		const strict = betaBinomial({ alpha: 80, beta: 20 })(single5); // ≈ 0.802

		expect(strict - 0.8).toBeLessThan(lenient - 0.8);
	});

	// The case the naive mean gets wrong (see naiveMean.test.ts, `it.fails`).
	it("ranks 500 ratings averaging 4.7 above a single 5★ rating", () => {
		const single = stats([0, 0, 0, 0, 1]);
		const many = stats([5, 5, 10, 95, 385]);

		expect(score(many)).toBeGreaterThan(score(single));
	});

	it.each([
		{ alpha: 0, beta: 2 },
		{ alpha: 8, beta: 0 },
		{ alpha: -1, beta: 2 },
		{ alpha: 8, beta: Number.NaN },
	])("throws when alpha is $alpha and beta is $beta", (options) => {
		expect(() => betaBinomial(options)).toThrow(
			"alpha and beta must be greater than 0",
		);
	});
});
