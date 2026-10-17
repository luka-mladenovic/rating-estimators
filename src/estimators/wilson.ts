import { toThumbs } from "../toThumbs.ts";
import type { Estimator } from "../types.ts";

export interface WilsonOptions {
	readonly z?: number;
}

export const zDefault = 1.96;

export function wilson({ z = zDefault }: WilsonOptions = {}): Estimator {
	if (!(z > 0)) {
		throw new Error(`z must be greater than 0, got ${z}`);
	}

	return (stats) => {
		// 			p̂ + z²/(2n) - z·√( p̂(1-p̂)/n + z²/(4n²) )
		// lower = ------------------------------------------
		// 			1 + z²/n

		const { up, down } = toThumbs(stats.stars);

		const n = up + down;

		if (n === 0) {
			return 0;
		}

		const p = up / n;

		const centre = p + z ** 2 / (2 * n);
		const margin = z * Math.sqrt((p * (1 - p)) / n + z ** 2 / (4 * n ** 2));
		const denominator = 1 + z ** 2 / n;

		return (centre - margin) / denominator;
	};
}
