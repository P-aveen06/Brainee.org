import { describe, expect, it } from "vitest";
import { getInitials } from "./utils";

describe("getInitials", () => {
	it("takes the first letter of the first two name parts", () => {
		expect(getInitials("Charan Kumar")).toBe("CK");
	});

	it("collapses repeated whitespace instead of emitting 'undefined'", () => {
		expect(getInitials("Charan  Kumar")).toBe("CK");
		expect(getInitials("Charan ")).toBe("C");
		expect(getInitials(" Charan Kumar")).toBe("CK");
	});

	it("caps at two letters", () => {
		expect(getInitials("Ana Maria Souza Lima")).toBe("AM");
	});

	it("falls back to U for missing or blank names", () => {
		expect(getInitials(null)).toBe("U");
		expect(getInitials(undefined)).toBe("U");
		expect(getInitials("   ")).toBe("U");
	});
});
