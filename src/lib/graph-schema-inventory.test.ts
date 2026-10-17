import { getTableName, isTable } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as currentSchema from "@/db/schema";
import { tableLabels } from "../../services/graph/src/schema";

describe("graph migration inventory", () => {
	it("accounts for every current application table, including company policies", () => {
		const currentTables = Object.values(currentSchema)
			.filter(isTable)
			.map(getTableName)
			.sort();
		expect(Object.keys(tableLabels).sort()).toEqual(currentTables);
	});
});
