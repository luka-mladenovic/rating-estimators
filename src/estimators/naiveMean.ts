import type { Estimator } from "../types.ts";

export const naiveMean: Estimator = (stats) => {
	const [n1, n2, n3, n4, n5] = stats.stars;
	const ratingCount = n1 + n2 + n3 + n4 + n5;
	const ratingSum = n1 + 2 * n2 + 3 * n3 + 4 * n4 + 5 * n5;

	if (!ratingCount) {
		return 0;
	}

	return ratingSum / ratingCount;
};
