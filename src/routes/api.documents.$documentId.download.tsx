import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "@/db/graph-query";
import { createDb } from "@/db";
import { projectDocuments } from "@/db/schema";
import { getCurrentUserWithState } from "@/lib/current-user.server";
import { AppError } from "@/lib/errors";
import { assertProjectAccess } from "@/lib/project-access";

function contentDisposition(fileName: string): string {
	const fallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
	return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function handleDownload({
	params,
}: {
	params: { documentId: string };
}): Promise<Response> {
	const { user } = await getCurrentUserWithState();
	if (!user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const db = createDb();
	const [doc] = await db
		.select()
		.from(projectDocuments)
		.where(eq(projectDocuments.id, params.documentId))
		.limit(1);

	if (!doc) {
		return new Response("Document not found.", { status: 404 });
	}

	try {
		await assertProjectAccess(db, user, doc.projectId, "viewer");
	} catch (err) {
		if (err instanceof AppError) {
			return new Response(err.message, { status: 404 });
		}
		throw err;
	}

	const object = await env.PROJECT_DOCS.get(doc.r2Key);
	if (!object) {
		return new Response("File data not found in object storage.", {
			status: 404,
		});
	}

	return new Response(object.body, {
		headers: {
			"Content-Type": doc.mimeType,
			"Content-Disposition": contentDisposition(doc.fileName),
			"Content-Length": String(object.size),
			"X-Content-Type-Options": "nosniff",
		},
	});
}

export const Route = createFileRoute("/api/documents/$documentId/download")({
	server: {
		handlers: {
			GET: handleDownload,
		},
	},
});
