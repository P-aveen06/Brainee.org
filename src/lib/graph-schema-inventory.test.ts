import { expect, it } from "vitest";
import { models } from "../../shared/graph/model";
import * as schema from "../db/schema";
it("covers all application graph models", () => {
	expect(Object.keys(schema).length).toBe(37);
	expect(models.length).toBe(37);
});
