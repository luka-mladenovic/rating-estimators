import { describe, expect, it } from "vitest";
import { toThumbs } from "../src/toThumbs.ts";
import type { StarCounts, Thumbs } from "../src/types.ts";

describe("toThumbs", () => {
	const cases: { name: string; stars: StarCounts; expected: Thumbs }[] = [
		{
			name: "one of each star value, 3★ ignored",
			stars: [1, 2, 3, 4, 5],
			expected: { up: 4 + 5, down: 1 + 2 },
		},
		{
			name: "only 4★ and 5★",
			stars: [0, 0, 0, 1, 2],
			expected: { up: 3, down: 0 },
		},
		{
			name: "only 1★ and 2★",
			stars: [3, 1, 0, 0, 0],
			expected: { up: 0, down: 4 },
		},
		{
			name: "no ratings",
			stars: [0, 0, 0, 0, 0],
			expected: { up: 0, down: 0 },
		},
		{
			// Seven ratings, zero votes: thumbs estimators see it as unrated.
			name: "only 3★",
			stars: [0, 0, 7, 0, 0],
			expected: { up: 0, down: 0 },
		},
		{
			name: "the 500-ratings item",
			stars: [5, 5, 10, 95, 385],
			expected: { up: 95 + 385, down: 5 + 5 },
		},
	];

	it.each(cases)("maps $name", ({ stars, expected }) => {
		expect(toThumbs(stars)).toEqual(expected);
	});
});
