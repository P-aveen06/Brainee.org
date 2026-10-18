/** Scheduled ingestion uses a server-configured identity and trusted source bytes. */
export interface IndexJobEnvironment {
	GRAPH_SERVICE_URL?: string;
	GRAPH_SERVICE_TOKEN?: string;
	DELIVERY_INDEX_ACTOR_SUBJECT?: string;
	PROJECT_DOCS: {
		get(key: string): Promise<{ body: ReadableStream; size: number } | null>;
	};
}

export async function runDocumentIndexJob(env: IndexJobEnvironment) {
	const {
		GRAPH_SERVICE_URL: url,
		GRAPH_SERVICE_TOKEN: token,
		DELIVERY_INDEX_ACTOR_SUBJECT: subject,
	} = env;
	if (!url || !token || !subject)
		return { state: "not_configured", processed: 0 };
	const headers = {
		authorization: `Bearer ${token}`,
		"content-type": "application/json",
	};
	const operation = async (name: string, payload: unknown) => {
		const response = await fetch(`${url.replace(/\/$/, "")}/operations`, {
			method: "POST",
			headers,
			body: JSON.stringify({ operation: name, subject, payload }),
			signal: AbortSignal.timeout(10000),
		});
		if (!response.ok)
			throw new Error("Document index job operation unavailable.");
		return (await response.json()) as {
			data: { documents: Array<{ id: string; r2Key: string }> };
		};
	};
	const queue = await operation("delivery.index_queue", {});
	const outcomes = [];
	for (const source of queue.data.documents) {
		try {
			const file = await env.PROJECT_DOCS.get(source.r2Key);
			if (!file || file.size > 25 * 1024 * 1024)
				throw new Error("Document source unavailable.");
			const response = await fetch(
				`${url.replace(/\/$/, "")}/delivery/documents/${encodeURIComponent(source.id)}/index`,
				{
					method: "POST",
					headers: {
						authorization: `Bearer ${token}`,
						"x-graph-subject": subject,
					},
					body: file.body,
					signal: AbortSignal.timeout(35000),
				},
			);
			if (response.status >= 500) throw new Error("Indexer unavailable.");
			const result = response.ok
				? ((await response.json()) as { data?: { status?: string } })
				: undefined;
			outcomes.push({
				id: source.id,
				status: result?.data?.status ?? "pending",
			});
		} catch {
			await operation("delivery.index_failure", { documentId: source.id });
			outcomes.push({ id: source.id, status: "pending" });
		}
	}
	return { state: "completed", processed: outcomes.length, outcomes };
}
