import { createFileRoute } from "@tanstack/react-router";
import { graphOperation } from "@/db/transport.server";
import { getCurrentUserWithState } from "@/lib/current-user.server";
import { parseDeliveryResult } from "../../shared/delivery-knowledge";

export const Route = createFileRoute(
	"/api/delivery/documents/$documentId/passages",
)({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const { user } = await getCurrentUserWithState();
				if (!user) return new Response("Unauthorized", { status: 401 });
				const position = Number(
					new URL(request.url).searchParams.get("position") ?? 0,
				);
				if (!Number.isInteger(position) || position < 0 || position > 10000)
					return new Response("Invalid passage.", { status: 400 });
				try {
					// Re-authorize and re-read the current version on every open. Never serve stored model text.
					const result = parseDeliveryResult(
						await graphOperation("delivery.passages", {
							documentId: params.documentId,
							offset: position,
							limit: 1,
						}),
					);
					const passages = result.passages as Array<{
						text: string;
						startChar: number;
						endChar: number;
						locations?: unknown;
					}>;
					const passage = passages?.[0];
					if (!passage)
						return new Response("This source passage is no longer available.", {
							status: 404,
						});
					return new Response(
						`${result.sources[0].label}\nCharacters ${passage.startChar}–${passage.endChar}\n${JSON.stringify(passage.locations ?? [])}\n\n${passage.text}`,
						{
							headers: {
								"content-type": "text/plain; charset=utf-8",
								"cache-control": "no-store",
								"x-content-type-options": "nosniff",
							},
						},
					);
				} catch {
					return new Response(
						"This source version is unavailable. Search for the current document.",
						{ status: 404 },
					);
				}
			},
		},
	},
});
