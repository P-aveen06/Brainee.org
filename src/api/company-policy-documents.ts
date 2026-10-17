import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { createDb } from "@/db";
import { companyPolicyDocuments, users } from "@/db/schema";
import { parsePolicyUpload } from "@/lib/company-policy-documents";
import { adminMiddleware, toClientError } from "@/lib/server-fn";

export const getCompanyPolicyDocuments = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(async () => {
		const db = createDb(env.DATABASE);
		return db
			.select({
				id: companyPolicyDocuments.id,
				title: companyPolicyDocuments.title,
				description: companyPolicyDocuments.description,
				fileName: companyPolicyDocuments.fileName,
				sizeBytes: companyPolicyDocuments.sizeBytes,
				createdAt: companyPolicyDocuments.createdAt,
				uploaderName: users.name,
			})
			.from(companyPolicyDocuments)
			.leftJoin(users, eq(companyPolicyDocuments.uploadedById, users.id))
			.orderBy(desc(companyPolicyDocuments.createdAt));
	});

export const uploadCompanyPolicyDocument = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: FormData) => parsePolicyUpload(data))
	.handler(async ({ data, context }) => {
		try {
			const id = crypto.randomUUID();
			const r2Key = `company-policies/${id}`;
			await env.PROJECT_DOCS.put(r2Key, await data.file.arrayBuffer(), {
				httpMetadata: { contentType: data.mimeType },
			});
			try {
				await createDb(env.DATABASE)
					.insert(companyPolicyDocuments)
					.values({
						id,
						title: data.title,
						description: data.description || null,
						r2Key,
						fileName: data.file.name,
						mimeType: data.mimeType,
						sizeBytes: data.file.size,
						uploadedById: context.user.id,
					});
			} catch (error) {
				await env.PROJECT_DOCS.delete(r2Key);
				throw error;
			}
			return { success: true, id };
		} catch (error) {
			return toClientError(error, "Failed to upload policy document.");
		}
	});
