import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { createDb } from "@/db";
import { companyPolicyDocuments } from "@/db/schema";
import { getCurrentUserWithState } from "./current-user.server";

export async function downloadCompanyPolicyDocument(
	documentId: string,
): Promise<Response> {
	const { user } = await getCurrentUserWithState();
	if (!user) return new Response("Unauthorized", { status: 401 });
	if (user.role !== "admin") return new Response("Forbidden", { status: 403 });

	const [doc] = await createDb(env.DATABASE)
		.select()
		.from(companyPolicyDocuments)
		.where(eq(companyPolicyDocuments.id, documentId))
		.limit(1);
	if (!doc) return new Response("Document not found.", { status: 404 });
	const object = await env.PROJECT_DOCS.get(doc.r2Key);
	if (!object) return new Response("File not found.", { status: 404 });
	return new Response(object.body, {
		headers: {
			"Content-Type": doc.mimeType,
			"Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName).replace(/'/g, "%27")}`,
			"Content-Length": String(object.size),
			"Cache-Control": "private, no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
