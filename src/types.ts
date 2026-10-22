export type Stars = 1 | 2 | 3 | 4 | 5;

export interface Item {
	readonly id: string;
	readonly name: string;
}

/** One user's rating of one item: a row in the ratings table. */
export interface Rating {
	readonly itemId: string;
	readonly userId: string;
	readonly value: Stars;
	readonly createdAt: Date;
}

/** Number of 1★, 2★, 3★, 4★ and 5★ ratings, in that order. */
export type StarCounts = readonly [number, number, number, number, number];

/** Share of 1★, 2★, 3★, 4★ and 5★ ratings, in that order; sums to 1. */
export type StarShares = readonly [number, number, number, number, number];

/** An item's ratings, aggregated: what the estimators read. */
export interface ItemStats {
	readonly itemId: string;
	readonly stars: StarCounts;
}

/** Turns an item's rating counts into a score; a higher score ranks higher. */
export type Estimator = (stats: ItemStats) => number;

/** Star ratings reduced to likes and dislikes: 4-5★ up, 1-2★ down, 3★ ignored. */
export interface Thumbs {
	readonly up: number;
	readonly down: number;
}
