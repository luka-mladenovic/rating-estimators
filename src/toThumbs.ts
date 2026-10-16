import type { StarCounts, Thumbs } from "./types.ts";

export function toThumbs(stars: StarCounts): Thumbs {
	const [n1, n2, , n4, n5] = stars;

	return {
		up: n4 + n5,
		down: n1 + n2,
	};
}
