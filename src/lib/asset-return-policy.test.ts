import { describe, expect, it } from "vitest";
import {
	type AssetCondition,
	isDamagedCondition,
	resolveAssetReturnRouting,
} from "./asset-return-policy";

describe("resolveAssetReturnRouting", () => {
	it("returns Brainee.org-owned equipment in good order to inventory", () => {
		const result = resolveAssetReturnRouting(true, "good");
		expect(result).toEqual({
			destination: "brainee_inventory",
			newStatus: "in_inventory",
			defectReason: null,
		});
	});

	it.each<AssetCondition>([
		"damaged",
		"defective",
	])("routes Brainee.org-owned equipment returned as %s to defective", (condition) => {
		const result = resolveAssetReturnRouting(true, condition);
		expect(result.destination).toBe("brainee_inventory");
		expect(result.newStatus).toBe("defective");
	});

	it("records the return note as the defect reason when damaged", () => {
		const result = resolveAssetReturnRouting(true, "damaged", "Cracked screen");
		expect(result.defectReason).toBe("Cracked screen");
	});

	it("falls back to a default defect reason when no note is given", () => {
		expect(resolveAssetReturnRouting(true, "defective").defectReason).toBe(
			"Reported on check-in",
		);
		expect(resolveAssetReturnRouting(true, "defective", "").defectReason).toBe(
			"Reported on check-in",
		);
	});

	it("surrenders client-owned equipment regardless of condition", () => {
		for (const condition of ["good", "damaged", "defective"] as const) {
			const result = resolveAssetReturnRouting(false, condition);
			expect(result).toEqual({
				destination: "client_surrendered",
				newStatus: "returned_to_client",
				defectReason: null,
			});
		}
	});

	it("treats an unknown or missing condition as undamaged", () => {
		expect(resolveAssetReturnRouting(true, null).newStatus).toBe(
			"in_inventory",
		);
		expect(resolveAssetReturnRouting(true, undefined).newStatus).toBe(
			"in_inventory",
		);
	});
});

describe("isDamagedCondition", () => {
	it("identifies only damaged and defective as damage", () => {
		expect(isDamagedCondition("damaged")).toBe(true);
		expect(isDamagedCondition("defective")).toBe(true);
		expect(isDamagedCondition("good")).toBe(false);
		expect(isDamagedCondition("fair")).toBe(false);
		expect(isDamagedCondition(null)).toBe(false);
	});
});
