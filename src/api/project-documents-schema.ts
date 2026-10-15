import { z } from "zod";
import { AppError } from "@/lib/errors";

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_MIME_TYPES = new Set([
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/svg+xml",
	"text/plain",
	"text/markdown",
	"text/csv",
	"application/json",
	"application/zip",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const CATEGORY = z.enum([
	"proposal",
	"sow",
	"contract",
	"design",
	"report",
	"minutes",
	"other",
]);

const uploadFieldsSchema = z.object({
	projectId: z.string().min(1),
	stageKey: z.string().min(1).nullable(),
	title: z.string().min(1, "Title is required"),
	description: z.string().nullable(),
	category: CATEGORY,
});

const supersedeFieldsSchema = z.object({
	documentId: z.string().min(1),
	title: z.string().min(1).nullable(),
	description: z.string().nullable(),
	category: CATEGORY.nullable(),
});

function stringOrNull(value: FormDataEntryValue | null): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

export interface UploadDocFormData {
	projectId: string;
	stageKey: string | null;
	title: string;
	description: string | null;
	category: z.infer<typeof CATEGORY>;
	file: File;
}

export function parseUploadDocFormData(formData: FormData): UploadDocFormData {
	const file = formData.get("file");
	if (!(file instanceof File)) {
		throw new AppError("A file is required.");
	}

	const fields = uploadFieldsSchema.parse({
		projectId: stringOrNull(formData.get("projectId")),
		stageKey: stringOrNull(formData.get("stageKey")),
		title: stringOrNull(formData.get("title")),
		description: stringOrNull(formData.get("description")),
		category: stringOrNull(formData.get("category")),
	});

	return { ...fields, file };
}

export interface SupersedeDocFormData {
	documentId: string;
	title: string | null;
	description: string | null;
	category: z.infer<typeof CATEGORY> | null;
	file: File;
}

export function parseSupersedeDocFormData(
	formData: FormData,
): SupersedeDocFormData {
	const file = formData.get("file");
	if (!(file instanceof File)) {
		throw new AppError("A file is required.");
	}

	const fields = supersedeFieldsSchema.parse({
		documentId: stringOrNull(formData.get("documentId")),
		title: stringOrNull(formData.get("title")),
		description: stringOrNull(formData.get("description")),
		category: stringOrNull(formData.get("category")),
	});

	return { ...fields, file };
}

export function sanitizeFileName(name: string): string {
	return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function computeChecksum(buffer: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", buffer);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
