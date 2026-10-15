export type UserRelation = {
	id?: string;
	email?: string | null;
	name?: string | null;
	avatar_url?: string | null;
};

export function getUserRelation(
	users: UserRelation | UserRelation[] | null | undefined,
): UserRelation {
	return Array.isArray(users) ? (users[0] ?? {}) : (users ?? {});
}
