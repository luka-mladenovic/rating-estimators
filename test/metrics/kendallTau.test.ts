import { describe, expect, it } from "vitest";
import { kendallTau } from "../../src/metrics/kendallTau.ts";

describe("kendallTau", () => {
	// Exact values, worked out by hand from the pair counts:
	//   a = (C - D) / all pairs, b = (C - D) / √((C + D + Tx) · (C + D + Ty))
	const exact: {
		name: string;
		x: number[];
		y: number[];
		a: number;
		b: number;
	}[] = [
		// 6 pairs, all concordant.
		{
			name: "the same order",
			x: [1, 2, 3, 4],
			y: [10, 20, 30, 40],
			a: 1,
			b: 1,
		},
		// 6 pairs, all discordant.
		{
			name: "reversed order",
			x: [1, 2, 3, 4],
			y: [40, 30, 20, 10],
			a: -1,
			b: -1,
		},
		// The smallest valid input: 1 pair.
		{ name: "2 items in order", x: [1, 2], y: [3, 4], a: 1, b: 1 },
		{ name: "2 items swapped", x: [1, 2], y: [4, 3], a: -1, b: -1 },
		// A-B discordant, C-D tied in y, the other 4 concordant:
		// C = 4, D = 1, Tx = 0, Ty = 1, 6 pairs.
		{
			name: "the worked example",
			x: [4.5, 4, 3.5, 3],
			y: [4.4, 4.6, 0, 0],
			a: (4 - 1) / 6,
			b: (4 - 1) / Math.sqrt((4 + 1 + 0) * (4 + 1 + 1)),
		},
		// Only the true best item stands out, the other 9 tie at 0: the best
		// item beats each of them (C = 9), the 9 tie with each other (Ty = 36).
		// 45 pairs. Tau-b forgives the ties, tau-a doesn't.
		{
			name: "only the best item standing out",
			x: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
			y: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
			a: 9 / 45,
			b: 9 / Math.sqrt(9 * (9 + 36)),
		},
	];

	it.each(exact)("scores $name as a = $a, b = $b", ({ x, y, a, b }) => {
		const tau = kendallTau(x, y);

		expect(tau.a).toBeCloseTo(a, 5);
		expect(tau.b).toBeCloseTo(b, 5);
	});

	// Values computed separately and rounded to 3 decimals, so the assertion
	// only checks 3 digits.
	const rounded: {
		name: string;
		x: number[];
		y: number[];
		a: number;
		b: number;
	}[] = [
		// Like a minimum count: four items score 0, the rest are mostly right.
		{
			name: "a minimum-count style ranking",
			x: [4.8, 4.6, 4.5, 4.3, 4.1, 3.9, 3.7, 3.5, 3.2, 3.0],
			y: [4.9, 0, 4.4, 4.6, 0, 3.8, 0, 3.6, 3.1, 0],
			a: 0.378,
			b: 0.406,
		},
		{
			name: "ties on both sides",
			x: [1, 2, 2, 3, 4, 4, 5, 6],
			y: [2, 1, 3, 3, 5, 4, 4, 6],
			a: 0.714,
			b: 0.769,
		},
	];

	it.each(rounded)("scores $name as about a = $a, b = $b", ({ x, y, a, b }) => {
		const tau = kendallTau(x, y);

		expect(tau.a).toBeCloseTo(a, 3);
		expect(tau.b).toBeCloseTo(b, 3);
	});

	it("only looks at the order, not the values", () => {
		const x = [3, 1, 4, 1.5, 5, 9, 2, 6];
		// Scaled and shifted: the values change, the order doesn't.
		const y = x.map((value) => 2 * value + 100);

		expect(kendallTau(x, y)).toEqual({ a: 1, b: 1 });
	});

	it("gives the same result with x and y swapped", () => {
		const x = [4.8, 4.6, 4.5, 4.3, 4.1, 3.9, 3.7, 3.5, 3.2, 3.0];
		const y = [4.9, 0, 4.4, 4.6, 0, 3.8, 0, 3.6, 3.1, 0];

		expect(kendallTau(y, x)).toEqual(kendallTau(x, y));
	});

	it("gives tau-a and tau-b the same value when nothing is tied", () => {
		const tau = kendallTau([1, 2, 3, 4, 5, 6], [2, 1, 4, 3, 6, 5]);

		expect(tau.a).toBeCloseTo(tau.b, 10);
	});

	// Accepted behaviour: an estimator that scores every item the same (e.g. a
	// minimum count no item reaches) carries no information. Tau-b would be
	// 0 / 0, so both return 0, "no better than random".
	it.each([
		{ name: "every y tied", x: [1, 2, 3], y: [5, 5, 5] },
		{ name: "every x tied", x: [5, 5, 5], y: [1, 2, 3] },
		{ name: "both sides fully tied", x: [1, 1, 1], y: [5, 5, 5] },
	])("returns 0 for both with $name", ({ x, y }) => {
		expect(kendallTau(x, y)).toEqual({ a: 0, b: 0 });
	});

	it("throws when x and y have different lengths", () => {
		expect(() => kendallTau([1, 2, 3], [1, 2])).toThrow(
			"x and y must have the same length, got 3 and 2",
		);
	});

	it.each<{ x: number[]; y: number[] }>([
		{ x: [], y: [] },
		{ x: [1], y: [1] },
	])("throws when there are fewer than 2 items: $x", ({ x, y }) => {
		expect(() => kendallTau(x, y)).toThrow("need at least 2 items");
	});

	it.each([
		{ name: "NaN in x", x: [1, Number.NaN, 3], y: [1, 2, 3], error: "x" },
		{ name: "NaN in y", x: [1, 2, 3], y: [Number.NaN, 2, 3], error: "y" },
		{
			name: "Infinity in y",
			x: [1, 2, 3],
			y: [1, 2, Number.POSITIVE_INFINITY],
			error: "y",
		},
		{
			name: "-Infinity in x",
			x: [Number.NEGATIVE_INFINITY, 2, 3],
			y: [1, 2, 3],
			error: "x",
		},
	])("throws on $name", ({ x, y, error }) => {
		expect(() => kendallTau(x, y)).toThrow(`every ${error} must be finite`);
	});
});
