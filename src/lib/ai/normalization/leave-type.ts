export interface ConfiguredLeaveType {
	slug: string;
	name: string;
}

export function resolveLeaveType(
	requested: string,
	types: ConfiguredLeaveType[],
): ConfiguredLeaveType | null {
	const normalized = requested.trim().toLowerCase().replace(/[-_]/g, " ");
	if (!normalized) return null;

	const exact = types.find((type) => {
		const slug = type.slug.toLowerCase().replace(/[-_]/g, " ");
		return slug === normalized || type.name.toLowerCase() === normalized;
	});
	if (exact) return exact;

	const partial = types.find((type) => {
		const slug = type.slug.toLowerCase().replace(/[-_]/g, " ");
		const name = type.name.toLowerCase();
		return (
			slug.includes(normalized) ||
			name.includes(normalized) ||
			normalized.includes(slug) ||
			normalized.includes(name)
		);
	});
	if (partial) return partial;

	const synonymGroups = [
		{
			requested: ["sick", "medical", "health", "doctor"],
			configured: ["sick", "medical"],
		},
		{
			requested: [
				"casual",
				"personal",
				"vacation",
				"pto",
				"earned",
				"privilege",
			],
			configured: ["personal", "casual"],
		},
		{
			requested: ["festival", "holiday", "diwali"],
			configured: ["festival"],
		},
	];
	for (const group of synonymGroups) {
		if (!group.requested.some((word) => normalized.includes(word))) continue;
		const match = types.find((type) => {
			const configured = `${type.slug} ${type.name}`.toLowerCase();
			return group.configured.some((word) => configured.includes(word));
		});
		if (match) return match;
	}
	return null;
}
