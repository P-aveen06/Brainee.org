export interface UserRecord {
	id: string;
	name: string;
	email: string;
	role: string;
	avatarUrl: string | null;
	avatar_url?: string | null;
	peerLeadId: string | null;
	peer_lead_id?: string | null;
	standardHours: number;
	standard_hours?: number;
}

export interface UserNode extends UserRecord {
	children: UserNode[];
}

/**
 * Builds a hierarchical tree from a flat array of users.
 * Roots are users with peerLeadId = null or whose peerLeadId is not present in the list of users.
 */
export function buildOrgTree(users: UserRecord[]): UserNode[] {
	const userMap = new Map<string, UserNode>();

	// Initialize map with empty children arrays
	for (const user of users) {
		const avatar = user.avatarUrl || user.avatar_url || null;
		const peerLead = user.peerLeadId || user.peer_lead_id || null;
		const stdHours = user.standardHours ?? user.standard_hours ?? 8;

		userMap.set(user.id, {
			...user,
			avatarUrl: avatar,
			avatar_url: avatar || undefined,
			peerLeadId: peerLead,
			peer_lead_id: peerLead || undefined,
			standardHours: stdHours,
			standard_hours: stdHours,
			children: [],
		});
	}

	const roots: UserNode[] = [];

	const wouldCreateCycle = (childId: string, parentId: string) => {
		let current: string | null | undefined = parentId;
		const visited = new Set<string>();

		while (current) {
			if (current === childId) return true;
			if (visited.has(current)) return true;
			visited.add(current);
			const currentUser = userMap.get(current);
			current = currentUser?.peerLeadId || currentUser?.peer_lead_id;
		}

		return false;
	};

	// Build tree hierarchy
	for (const user of users) {
		const node = userMap.get(user.id);
		if (!node) continue;
		const peerLeadId = user.peerLeadId || user.peer_lead_id;
		if (
			peerLeadId &&
			userMap.has(peerLeadId) &&
			!wouldCreateCycle(user.id, peerLeadId)
		) {
			const parent = userMap.get(peerLeadId);
			if (parent) {
				parent.children.push(node);
			} else {
				roots.push(node);
			}
		} else {
			roots.push(node);
		}
	}

	// Sort children by name for visual consistency
	const sortTree = (node: UserNode) => {
		node.children.sort((a, b) => a.name.localeCompare(b.name));
		for (const child of node.children) {
			sortTree(child);
		}
	};
	for (const root of roots) {
		sortTree(root);
	}

	// Put admins at the top, then leads, then users
	const roleWeights: Record<string, number> = { admin: 3, lead: 2, user: 1 };
	roots.sort(
		(a, b) =>
			(roleWeights[b.role] || 0) - (roleWeights[a.role] || 0) ||
			a.name.localeCompare(b.name),
	);

	return roots;
}

/**
 * Recursively searches the tree and returns:
 * 1. A set of matching node IDs.
 * 2. A set of ancestor node IDs that must be expanded to make the matching nodes visible.
 */
export function searchOrgTree(
	roots: UserNode[],
	query: string,
): { matches: Set<string>; mustExpand: Set<string> } {
	const matches = new Set<string>();
	const mustExpand = new Set<string>();
	const cleanQuery = query.trim().toLowerCase();

	if (!cleanQuery) {
		return { matches, mustExpand };
	}

	// Helper function returning true if any descendant (or self) matches
	const checkNode = (node: UserNode, ancestors: string[]): boolean => {
		const isMatch =
			node.name.toLowerCase().includes(cleanQuery) ||
			node.email.toLowerCase().includes(cleanQuery) ||
			node.role.toLowerCase().includes(cleanQuery);

		if (isMatch) {
			matches.add(node.id);
			for (const id of ancestors) {
				mustExpand.add(id);
			}
		}

		let hasMatchingDescendant = false;
		const currentAncestors = [...ancestors, node.id];

		for (const child of node.children) {
			const childMatch = checkNode(child, currentAncestors);
			if (childMatch) {
				hasMatchingDescendant = true;
			}
		}

		return isMatch || hasMatchingDescendant;
	};

	for (const root of roots) {
		checkNode(root, []);
	}

	return { matches, mustExpand };
}
