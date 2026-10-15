import { describe, expect, it } from "vitest";

interface AssetReturnRoutingResult {
	destination: "brainee_inventory" | "client_surrendered";
	newStatus: "in_inventory" | "defective" | "returned_to_client";
}

function resolveAssetReturnRouting(
	isOwnerInternal: boolean,
	conditionIn: "good" | "fair" | "damaged" | "defective",
): AssetReturnRoutingResult {
	if (isOwnerInternal) {
		// Brainee.org owned asset returns to inventory (or defective if damaged/broken)
		if (conditionIn === "defective" || conditionIn === "damaged") {
			return {
				destination: "brainee_inventory",
				newStatus: "defective",
			};
		}
		return {
			destination: "brainee_inventory",
			newStatus: "in_inventory",
		};
	}

	// Client-owned asset returned / surrendered to external partner
	return {
		destination: "client_surrendered",
		newStatus: "returned_to_client",
	};
}

function calculateAccountExpiryUrgency(
	todayStr: string,
	expiryDateStr: string | null,
	renewalDateStr: string | null,
): { level: "urgent" | "warning" | "ok" | "none"; daysRemaining: number } {
	const target = renewalDateStr || expiryDateStr;
	if (!target) return { level: "none", daysRemaining: 999 };

	const today = new Date(todayStr).getTime();
	const exp = new Date(target).getTime();
	const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

	if (diffDays <= 7) return { level: "urgent", daysRemaining: diffDays };
	if (diffDays <= 30) return { level: "warning", daysRemaining: diffDays };
	return { level: "ok", daysRemaining: diffDays };
}

function resolveAssetTier(
	assetType: string,
	category: string,
): "capital_asset" | "bulk_peripheral" | "digital_account" {
	if (assetType === "digital_account" || category === "digital_account") {
		return "digital_account";
	}
	if (
		assetType === "bulk_peripheral" ||
		category === "accessory" ||
		category === "charger" ||
		category === "bag"
	) {
		return "bulk_peripheral";
	}
	return "capital_asset";
}

function isCustodyConfirmed(assignment: {
	acknowledgedAt?: Date | string | null;
}): boolean {
	return Boolean(assignment.acknowledgedAt);
}

function hasOpenIssue(assignment: { issueStatus?: string | null }): boolean {
	return (
		assignment.issueStatus === "open" ||
		assignment.issueStatus === "investigating"
	);
}

describe("Asset Management & Smart Return Routing", () => {
	it("returns Brainee.org-owned good condition item to Brainee.org available inventory", () => {
		const result = resolveAssetReturnRouting(true, "good");
		expect(result.destination).toBe("brainee_inventory");
		expect(result.newStatus).toBe("in_inventory");
	});

	it("returns Brainee.org-owned damaged item to Brainee.org inventory flagged as defective", () => {
		const result = resolveAssetReturnRouting(true, "damaged");
		expect(result.destination).toBe("brainee_inventory");
		expect(result.newStatus).toBe("defective");
	});

	it("routes Client-owned equipment to client_surrendered and marks returned_to_client", () => {
		const result = resolveAssetReturnRouting(false, "good");
		expect(result.destination).toBe("client_surrendered");
		expect(result.newStatus).toBe("returned_to_client");
	});

	it("calculates urgency correctly for expiring client accounts", () => {
		const urgent = calculateAccountExpiryUrgency(
			"2026-08-25",
			"2026-08-28",
			null,
		);
		expect(urgent.level).toBe("urgent");
		expect(urgent.daysRemaining).toBe(3);

		const warning = calculateAccountExpiryUrgency(
			"2026-08-25",
			null,
			"2026-09-10",
		);
		expect(warning.level).toBe("warning");
		expect(warning.daysRemaining).toBe(16);

		const ok = calculateAccountExpiryUrgency("2026-08-25", "2026-12-01", null);
		expect(ok.level).toBe("ok");
		expect(ok.daysRemaining).toBeGreaterThan(30);

		const none = calculateAccountExpiryUrgency("2026-08-25", null, null);
		expect(none.level).toBe("none");
	});

	it("correctly classifies asset tier from category and assetType", () => {
		expect(resolveAssetTier("capital_asset", "laptop")).toBe("capital_asset");
		expect(resolveAssetTier("physical", "monitor")).toBe("capital_asset");
		expect(resolveAssetTier("bulk_peripheral", "accessory")).toBe(
			"bulk_peripheral",
		);
		expect(resolveAssetTier("physical", "charger")).toBe("bulk_peripheral");
		expect(resolveAssetTier("physical", "bag")).toBe("bulk_peripheral");
		expect(resolveAssetTier("digital_account", "digital_account")).toBe(
			"digital_account",
		);
	});

	it("evaluates employee acknowledgment custody state", () => {
		const unacknowledged = {
			assignedDate: "2026-08-25",
			acknowledgedAt: null,
			issueStatus: null,
		};
		expect(isCustodyConfirmed(unacknowledged)).toBe(false);

		const acknowledged = {
			assignedDate: "2026-08-25",
			acknowledgedAt: new Date("2026-08-26"),
			issueStatus: null,
		};
		expect(isCustodyConfirmed(acknowledged)).toBe(true);

		const issue = {
			assignedDate: "2026-08-25",
			acknowledgedAt: new Date("2026-08-26"),
			issueStatus: "open",
		};
		expect(hasOpenIssue(issue)).toBe(true);
	});
});
