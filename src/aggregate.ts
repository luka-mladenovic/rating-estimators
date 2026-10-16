import type { Item, ItemStats, Rating } from "./types.ts";

export function aggregate(
	items: readonly Item[],
	ratings: readonly Rating[],
): ItemStats[] {
	type Counters = [number, number, number, number, number];
	const countsByItem = new Map<string, Counters>();

	for (const item of items) {
		countsByItem.set(item.id, [0, 0, 0, 0, 0]);
	}

	for (const rating of ratings) {
		const counts = countsByItem.get(rating.itemId);
		if (!counts) {
			throw new Error(`Rating for unknown item ${rating.itemId}`);
		}

		const index = rating.value - 1;
		if (counts[index] === undefined) {
			throw new Error(
				`Invalid star value ${rating.value} for item ${rating.itemId}`,
			);
		}
		counts[index]++;
	}

	const stats: ItemStats[] = [];
	for (const [itemId, stars] of countsByItem) {
		stats.push({ itemId, stars });
	}
	return stats;
}
