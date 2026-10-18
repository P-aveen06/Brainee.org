import { z } from "zod";
import { AppError } from "./errors";

export const POLICY_MAX_FILE_SIZE = 25 * 1024 * 1024;
export const POLICY_FILE_ACCEPT = ".pdf,.doc,.docx,.txt";
const POLICY_MIME_TYPES: Record<string, string> = {
	pdf: "application/pdf",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	txt: "text/plain",
};

export function validatePolicyFile(file: File): string {
	if (file.size === 0) throw new AppError("Choose a non-empty document.");
	if (file.size > POLICY_MAX_FILE_SIZE) {
		throw new AppError("File exceeds the 25 MB limit.");
	}
	const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
	const mimeType = POLICY_MIME_TYPES[extension];
	const uploadedType = file.type.split(";")[0].trim().toLowerCase();
	if (
		typeof mimeType !== "string" ||
		(uploadedType &&
			uploadedType !== mimeType &&
			uploadedType !== "application/octet-stream")
	) {
		throw new AppError("Choose a PDF, DOC, DOCX, or TXT document.");
	}
	return mimeType;
}

export function parsePolicyUpload(formData: FormData) {
	const file = formData.get("file");
	if (!(file instanceof File)) throw new AppError("A document is required.");
	const mimeType = validatePolicyFile(file);
	const fields = z
		.object({
			title: z.string().trim().min(1, "Title is required.").max(200),
			description: z.string().trim().max(2000),
			revisionOfId: z.string().uuid().optional(),
		})
		.parse({
			title: formData.get("title"),
			description: formData.get("description") ?? "",
			revisionOfId: formData.get("revisionOfId") || undefined,
		});
	return { ...fields, file, mimeType };
}
