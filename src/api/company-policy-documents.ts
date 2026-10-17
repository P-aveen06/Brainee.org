import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createDb } from "@/db";
import { aliasedTable, and, desc, eq, inArray } from "@/db/graph-query";
import { companyPolicyDocuments, users } from "@/db/schema";
import { parsePolicyUpload } from "@/lib/company-policy-documents";
import {
	assertCompanyPolicyAdmin,
	assertCompanyPolicyTransition,
	createPolicyDraftRevision,
	parsePolicyEffectiveDate,
} from "@/lib/company-policy-workflow";
import { AppError, adminMiddleware, toClientError } from "@/lib/server-fn";

const uploader = aliasedTable(users, "policyUploader");
const publisher = aliasedTable(users, "policyPublisher");
const archiver = aliasedTable(users, "policyArchiver");

export const getCompanyPolicyDocuments = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(async () => {
		const db = createDb();
		return db
			.select({
				id: companyPolicyDocuments.id,
				title: companyPolicyDocuments.title,
				description: companyPolicyDocuments.description,
				fileName: companyPolicyDocuments.fileName,
				mimeType: companyPolicyDocuments.mimeType,
				sizeBytes: companyPolicyDocuments.sizeBytes,
				createdAt: companyPolicyDocuments.createdAt,
				uploaderName: uploader.name,
				status: companyPolicyDocuments.status,
				version: companyPolicyDocuments.version,
				revisionOfId: companyPolicyDocuments.revisionOfId,
				publishedById: companyPolicyDocuments.publishedById,
				publishedAt: companyPolicyDocuments.publishedAt,
				effectiveDate: companyPolicyDocuments.effectiveDate,
				publisherName: publisher.name,
				archivedById: companyPolicyDocuments.archivedById,
				archivedAt: companyPolicyDocuments.archivedAt,
				archiverName: archiver.name,
			})
			.from(companyPolicyDocuments)
			.leftJoin(uploader, eq(companyPolicyDocuments.uploadedById, uploader.id))
			.leftJoin(
				publisher,
				eq(companyPolicyDocuments.publishedById, publisher.id),
			)
			.leftJoin(archiver, eq(companyPolicyDocuments.archivedById, archiver.id))
			.orderBy(desc(companyPolicyDocuments.createdAt));
	});

export const uploadCompanyPolicyDocument = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: FormData) => parsePolicyUpload(data))
	.handler(async ({ data, context }) => {
		try {
			assertCompanyPolicyAdmin(context.user.role);
			const db = createDb();
			let previousVersion: number | undefined;
			if (data.revisionOfId) {
				const [previous] = await db
					.select({ version: companyPolicyDocuments.version })
					.from(companyPolicyDocuments)
					.where(eq(companyPolicyDocuments.id, data.revisionOfId))
					.limit(1);
				if (!previous)
					throw new AppError("The document to revise was not found.");
				previousVersion = previous.version;
			}
			const lifecycle = createPolicyDraftRevision(previousVersion);
			const id = crypto.randomUUID();
			const r2Key = `company-policies/${id}`;
			const buffer = await data.file.arrayBuffer();
			try {
				await env.PROJECT_DOCS.put(r2Key, buffer, {
					httpMetadata: { contentType: data.mimeType },
				});
			} catch {
				throw new AppError("Could not store the document. Please try again.");
			}
			try {
				await db.insert(companyPolicyDocuments).values({
					id,
					title: data.title,
					description: data.description || null,
					r2Key,
					fileName: data.file.name,
					mimeType: data.mimeType,
					sizeBytes: buffer.byteLength,
					uploadedById: context.user.id,
					...lifecycle,
					revisionOfId: data.revisionOfId ?? null,
				});
			} catch (error) {
				console.error("Could not save policy document metadata", error);
				try {
					await env.PROJECT_DOCS.delete(r2Key);
				} catch (cleanupError) {
					console.error(
						"Could not clean up failed policy upload",
						cleanupError,
					);
					throw new AppError(
						"The file was stored, but its document record could not be saved or cleaned up. Contact an administrator before retrying.",
					);
				}
				throw new AppError(
					"The document details could not be saved. The uploaded file was removed; please try again.",
				);
			}
			return { success: true, id };
		} catch (error) {
			return toClientError(error, "Failed to upload policy document.");
		}
	});

const publicationInput = z.object({
	documentId: z.string().uuid(),
	effectiveDate: z.string(),
});

export const publishCompanyPolicyDocument = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => publicationInput.parse(data))
	.handler(async ({ data, context }) => {
		try {
			assertCompanyPolicyAdmin(context.user.role);
			const db = createDb();
			const [document] = await db
				.select({ status: companyPolicyDocuments.status })
				.from(companyPolicyDocuments)
				.where(eq(companyPolicyDocuments.id, data.documentId))
				.limit(1);
			if (!document) throw new AppError("Policy document not found.");
			assertCompanyPolicyTransition(document.status, "published");
			const effectiveDate = parsePolicyEffectiveDate(data.effectiveDate);
			const publishedAt = new Date();
			const updated = await db
				.update(companyPolicyDocuments)
				.set({
					status: "published",
					publishedById: context.user.id,
					publishedAt,
					effectiveDate,
				})
				.where(
					and(
						eq(companyPolicyDocuments.id, data.documentId),
						eq(companyPolicyDocuments.status, "draft"),
					),
				)
				.returning({ id: companyPolicyDocuments.id });
			if (!updated.length)
				throw new AppError(
					"This document changed during review. Refresh and try again.",
				);
			return { success: true };
		} catch (error) {
			return toClientError(error, "Failed to publish policy document.");
		}
	});

export const archiveCompanyPolicyDocument = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ documentId: z.string().uuid() }).parse(data),
	)
	.handler(async ({ data, context }) => {
		try {
			assertCompanyPolicyAdmin(context.user.role);
			const db = createDb();
			const [document] = await db
				.select({ status: companyPolicyDocuments.status })
				.from(companyPolicyDocuments)
				.where(eq(companyPolicyDocuments.id, data.documentId))
				.limit(1);
			if (!document) throw new AppError("Policy document not found.");
			assertCompanyPolicyTransition(document.status, "archived");
			const archivedAt = new Date();
			const updated = await db
				.update(companyPolicyDocuments)
				.set({
					status: "archived",
					archivedById: context.user.id,
					archivedAt,
				})
				.where(
					and(
						eq(companyPolicyDocuments.id, data.documentId),
						inArray(companyPolicyDocuments.status, ["draft", "published"]),
					),
				)
				.returning({ id: companyPolicyDocuments.id });
			if (!updated.length)
				throw new AppError(
					"This document changed during review. Refresh and try again.",
				);
			return { success: true };
		} catch (error) {
			return toClientError(error, "Failed to archive policy document.");
		}
	});
