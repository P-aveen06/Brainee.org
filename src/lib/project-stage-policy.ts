export interface StageChecklistItemLike {
	id: string;
	title: string;
	isRequired: boolean;
	status: string; // 'pending' | 'done' | 'not_applicable'
}

export interface StageChecklistAssessment {
	canAdvance: boolean;
	unmetRequiredItems: Array<{ id: string; title: string }>;
	totalCount: number;
	completedCount: number;
	requiredCount: number;
	requiredMetCount: number;
	percentComplete: number;
}

/**
 * Pure policy evaluating whether a stage's checklist permits stage completion or advancement.
 * An item satisfies requirements if its status is 'done' or 'not_applicable'.
 * Stage transition is strictly blocked if any isRequired item remains 'pending'.
 */
export function assessStageChecklist(
	items: StageChecklistItemLike[],
): StageChecklistAssessment {
	const totalCount = items.length;
	let completedCount = 0;
	let requiredCount = 0;
	let requiredMetCount = 0;
	const unmetRequiredItems: Array<{ id: string; title: string }> = [];

	for (const item of items) {
		const isMet = item.status === "done" || item.status === "not_applicable";
		if (isMet) {
			completedCount += 1;
		}

		if (item.isRequired) {
			requiredCount += 1;
			if (isMet) {
				requiredMetCount += 1;
			} else {
				unmetRequiredItems.push({
					id: item.id,
					title: item.title,
				});
			}
		}
	}

	const percentComplete =
		totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

	return {
		canAdvance: unmetRequiredItems.length === 0,
		unmetRequiredItems,
		totalCount,
		completedCount,
		requiredCount,
		requiredMetCount,
		percentComplete,
	};
}
