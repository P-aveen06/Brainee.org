import { tryIndexDeliveryDocument } from "@/lib/ai/delivery-documents.server";
import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "@/db/graph-query";
import { z } from "zod";
import { createDb } from "@/db";
import { projectDocuments, projectEvents, users } from "@/db/schema";
import { assertProjectAccess } from "@/lib/project-access";
import { authMiddleware, toClientError } from "@/lib/server-fn";
import {
	ALLOWED_MIME_TYPES,
	computeChecksum,
	MAX_FILE_SIZE_BYTES,
	parseSupersedeDocFormData,
	parseUploadDocFormData,
	sanitizeFileName,
} from "./project-documents-schema";

export const getProjectDocuments = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ projectId: z.string() }).parse(data),
	)
	.handler(async ({ data: input, context }) => {
		const db = createDb();
		const access = await assertProjectAccess(
			db,
			context.user,
			input.projectId,
			"viewer",
		);

		const docs = await db
			.select({
				id: projectDocuments.id,
				projectId: projectDocuments.projectId,
				stageKey: projectDocuments.stageKey,
				title: projectDocuments.title,
				description: projectDocuments.description,
				category: projectDocuments.category,
				fileName: projectDocuments.fileName,
				mimeType: projectDocuments.mimeType,
				sizeBytes: projectDocuments.sizeBytes,
				version: projectDocuments.version,
				supersedesDocumentId: projectDocuments.supersedesDocumentId,
				status: projectDocuments.status,
				uploadedById: projectDocuments.uploadedById,
				uploaderName: users.name,
				uploaderEmail: users.email,
				createdAt: projectDocuments.createdAt,
				updatedAt: projectDocuments.updatedAt,
			})
			.from(projectDocuments)
			.leftJoin(users, eq(projectDocuments.uploadedById, users.id))
			.where(eq(projectDocuments.projectId, input.projectId))
			.orderBy(desc(projectDocuments.createdAt));

		return { documents: docs, access };
	});

export const uploadProjectDocument = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: FormData) => parseUploadDocFormData(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			await assertProjectAccess(
				db,
				context.user,
				input.projectId,
				"contributor",
			);

			if (!ALLOWED_MIME_TYPES.has(input.file.type)) {
				return { error: `File type '${input.file.type}' is not supported.` };
			}
			if (input.file.size > MAX_FILE_SIZE_BYTES) {
				return { error: "File exceeds the 25 MB limit." };
			}

			const buffer = await input.file.arrayBuffer();
			const checksum = await computeChecksum(buffer);

			const docId = crypto.randomUUID();
			const cleanName = sanitizeFileName(input.file.name);
			const r2Key = `projects/${input.projectId}/${docId}/v1/${cleanName}`;

			await env.PROJECT_DOCS.put(r2Key, buffer, {
				httpMetadata: { contentType: input.file.type },
			});

			await db.insert(projectDocuments).values({
				id: docId,
				projectId: input.projectId,
				stageKey: input.stageKey,
				title: input.title,
				description: input.description,
				category: input.category,
				r2Key,
				fileName: input.file.name,
				mimeType: input.file.type,
				sizeBytes: buffer.byteLength,
				version: 1,
				status: "final",
				uploadedById: context.user.id,
				checksum,
			});

			await db.insert(projectEvents).values({
				id: crypto.randomUUID(),
				projectId: input.projectId,
				eventType: "document_uploaded",
				actorId: context.user.id,
				entityType: "document",
				entityId: docId,
				details: JSON.stringify({
					title: input.title,
					fileName: input.file.name,
					category: input.category,
					sizeBytes: buffer.byteLength,
				}),
			});

			return {
				success: true,
				id: docId,
				deliveryIndex: await tryIndexDeliveryDocument(docId),
			};
		} catch (err) {
			return toClientError(err, "Failed to upload document.");
		}
	});

export const supersedeDocument = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: FormData) => parseSupersedeDocFormData(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const [prev] = await db
				.select()
				.from(projectDocuments)
				.where(eq(projectDocuments.id, input.documentId));

			if (!prev) return { error: "Document to supersede not found." };
			await assertProjectAccess(
				db,
				context.user,
				prev.projectId,
				"contributor",
			);

			if (!ALLOWED_MIME_TYPES.has(input.file.type)) {
				return { error: `File type '${input.file.type}' is not supported.` };
			}
			if (input.file.size > MAX_FILE_SIZE_BYTES) {
				return { error: "File exceeds the 25 MB limit." };
			}

			const buffer = await input.file.arrayBuffer();
			const checksum = await computeChecksum(buffer);

			const newDocId = crypto.randomUUID();
			const newVersion = prev.version + 1;
			const cleanName = sanitizeFileName(input.file.name);
			const r2Key = `projects/${prev.projectId}/${newDocId}/v${newVersion}/${cleanName}`;

			await env.PROJECT_DOCS.put(r2Key, buffer, {
				httpMetadata: { contentType: input.file.type },
			});

			await db
				.update(projectDocuments)
				.set({ status: "superseded", updatedAt: new Date() })
				.where(eq(projectDocuments.id, prev.id));

			await db.insert(projectDocuments).values({
				id: newDocId,
				projectId: prev.projectId,
				stageKey: prev.stageKey,
				title: input.title || prev.title,
				description: input.description || prev.description,
				category: input.category || prev.category,
				r2Key,
				fileName: input.file.name,
				mimeType: input.file.type,
				sizeBytes: buffer.byteLength,
				version: newVersion,
				supersedesDocumentId: prev.id,
				status: "final",
				uploadedById: context.user.id,
				checksum,
			});

			return {
				success: true,
				id: newDocId,
				deliveryIndex: await tryIndexDeliveryDocument(newDocId),
			};
		} catch (err) {
			return toClientError(err, "Failed to upload new version.");
		}
	});

export const deleteProjectDocument = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ documentId: z.string() }).parse(data),
	)
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const [doc] = await db
				.select()
				.from(projectDocuments)
				.where(eq(projectDocuments.id, input.documentId));

			if (!doc) return { error: "Document not found." };
			await assertProjectAccess(db, context.user, doc.projectId, "manager");

			await env.PROJECT_DOCS.delete(doc.r2Key);

			await db
				.delete(projectDocuments)
				.where(eq(projectDocuments.id, input.documentId));

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to delete document.");
		}
	});
