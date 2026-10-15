/**
 * Where an asset goes when it comes back, and what state it lands in.
 *
 * This rule was previously written out twice — in `returnAsset` and in
 * `offboardClientDeployment` — and the two copies disagreed: the offboard path
 * hardcoded a "good" condition and so could never route damaged equipment to
 * `defective`. Both now call this, as does the departure clearance flow.
 */

export type AssetCondition = "new" | "good" | "fair" | "damaged" | "defective";

export type AssetReturnDestination =
	| "brainee_inventory"
	| "client_surrendered"
	| "scrapped";

export type AssetReturnStatus =
	| "in_inventory"
	| "defective"
	| "returned_to_client";

export interface AssetReturnRouting {
	destination: AssetReturnDestination;
	newStatus: AssetReturnStatus;
	/** Non-null only when the asset came back damaged, for `assets.defect_reason`. */
	defectReason: string | null;
}

export function isDamagedCondition(
	condition: AssetCondition | string | null | undefined,
): boolean {
	return condition === "damaged" || condition === "defective";
}

/**
 * @param isOwnerInternal `companies.is_internal` for the asset's owning company —
 *   Brainee.org-owned equipment comes back to us, client-owned equipment is surrendered.
 */
export function resolveAssetReturnRouting(
	isOwnerInternal: boolean,
	conditionIn: AssetCondition | string | null | undefined,
	returnNotes?: string | null,
): AssetReturnRouting {
	const damaged = isDamagedCondition(conditionIn);

	if (isOwnerInternal) {
		return {
			destination: "brainee_inventory",
			newStatus: damaged ? "defective" : "in_inventory",
			defectReason: damaged ? returnNotes || "Reported on check-in" : null,
		};
	}

	return {
		destination: "client_surrendered",
		newStatus: "returned_to_client",
		defectReason: null,
	};
}
