import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { aggregate } from "../src/aggregate.ts";
import type { Item, Rating, Stars } from "../src/types.ts";

const items: Item[] = [
	{ id: "a", name: faker.commerce.productName() },
	{ id: "b", name: faker.commerce.productName() },
	{ id: "c", name: faker.commerce.productName() },
];

const at = new Date("2026-01-01");

describe("aggregate", () => {
	it("counts each star value per item, including items with no ratings", () => {
		const ratings: Rating[] = [
			{ itemId: "a", userId: "u1", value: 5, createdAt: at },
			{ itemId: "a", userId: "u2", value: 4, createdAt: at },
			{ itemId: "a", userId: "u3", value: 5, createdAt: at },
			{ itemId: "b", userId: "u1", value: 1, createdAt: at },
		];

		expect(aggregate(items, ratings)).toEqual([
			{ itemId: "a", stars: [0, 0, 0, 1, 2] },
			{ itemId: "b", stars: [1, 0, 0, 0, 0] },
			{ itemId: "c", stars: [0, 0, 0, 0, 0] },
		]);
	});

	it("throws an error on invalid rating value", () => {
		const ratings: Rating[] = [
			{ itemId: "a", userId: "u1", value: 0 as Stars, createdAt: at },
		];

		expect(() => aggregate(items, ratings)).toThrow("Invalid star value");
	});

	it("throws an error on rating with no item", () => {
		const ratings: Rating[] = [
			{ itemId: "d", userId: "u1", value: 0 as Stars, createdAt: at },
		];

		expect(() => aggregate(items, ratings)).toThrow("Rating for unknown item");
	});
});
