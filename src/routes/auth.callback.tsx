import { createFileRoute } from "@tanstack/react-router";

/** Old bookmarked OAuth callbacks now return to password sign-in. */
export function handleAuthCallbackRequest({
	request,
}: {
	request: Request;
}): Response {
	return new Response(null, {
		status: 302,
		headers: { Location: new URL("/sign-in", request.url).toString() },
	});
}

export const Route = createFileRoute("/auth/callback")({
	server: { handlers: { GET: handleAuthCallbackRequest } },
});
