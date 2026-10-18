import { graphOperation } from "@/db/transport.server";
import {
	ensureDeliveryDocumentIndexed,
	tryIndexDeliveryDocument,
} from "../delivery-documents.server";
import {
	parseDeliveryManifest,
	parseDeliveryInput,
	parseDeliveryResult,
	type DeliveryOperation,
} from "../../../../shared/delivery-knowledge";
import type { ToolHandler } from "./tool-types";

const pagination = {
	offset: {
		type: "integer",
		minimum: 0,
		description: "Use nextOffset to retrieve further evidence.",
	},
	limit: { type: "integer", minimum: 1, maximum: 50 },
};
const query = { type: "string", maxLength: 2000 };
const concepts = {
	type: "array",
	maxItems: 24,
	items: { type: "string", maxLength: 120 },
	description:
		"Relevant synonyms and technical alternatives, e.g. authentication, sign in, SSO.",
};

function deliveryTool(
	name: string,
	operation: DeliveryOperation,
	description: string,
	properties: Record<string, unknown>,
	required: string[],
): ToolHandler {
	return {
		name,
		description,
		timeoutMs: operation === "delivery.passages" ? 40000 : 12000,
		parameters: {
			type: "object",
			properties,
			required,
			additionalProperties: false,
		},
		async execute(args) {
			const payload = parseDeliveryInput(operation, args);
			if (operation === "delivery.passages")
				await ensureDeliveryDocumentIndexed(payload.documentId as string);
			const data = parseDeliveryResult(
				await graphOperation(operation, payload),
			);
			return {
				success: true,
				data,
				knowledgeScope: "company_delivery",
				groundedRecordIds: data.sources.map((source) => source.id),
				groundedLabels: data.sources,
			};
		},
	};
}

export const searchDeliveryKnowledgeTool = deliveryTool(
	"search_delivery_knowledge",
	"delivery.search",
	"Discover reusable functionality, tasks, estimates, blockers, decisions, documents and project contributors across the company. Includes completed and in-progress work. Delivery knowledge only; no HR data.",
	{ query, concepts, ...pagination },
	["query"],
);

export const getImplementationContextTool = deliveryTool(
	"get_implementation_context",
	"delivery.context",
	"Expand a discovered project or task into its task hierarchy, original estimates/actual hours, decisions, document references, blockers and contributors. A task selects its full root task family. Other sections are project-wide context. Paginate each section separately when hasMore is true.",
	{
		projectId: {
			type: "string",
			description: "Discovered project ID or code.",
		},
		taskId: { type: "string" },
		section: {
			type: "string",
			enum: ["all", "tasks", "decisions", "documents", "updates", "people"],
		},
		...pagination,
	},
	["projectId"],
);

export const readDocumentPassagesTool = deliveryTool(
	"read_document_passages",
	"delivery.passages",
	"Read cited passages from a discovered project document. Extracts current PDF, DOCX, text, Markdown, CSV or JSON on demand. Reports unsupported, empty and truncated extraction. Omit query to read sequential passages.",
	{
		documentId: { type: "string" },
		query,
		concepts,
		...pagination,
		limit: { type: "integer", minimum: 1, maximum: 20 },
	},
	["documentId"],
);

/** One file per invocation keeps backfill bounded and resumable without a job queue. */
export const indexDeliveryDocumentsTool: ToolHandler = {
	name: "index_delivery_documents",
	description:
		"Administrator only: index one existing delivery document per call. Use nextOffset to continue a resumable backfill. Only extracted text is written; project records are preserved. Failed files return pending and can be retried at the same offset. Do not automatically backfill during ordinary search.",
	timeoutMs: 40000,
	parameters: {
		type: "object",
		properties: { offset: { type: "integer", minimum: 0, maximum: 10000 } },
		additionalProperties: false,
	},
	async execute(args, ctx) {
		if (ctx.user.role !== "admin")
			return { success: false, error: "Administrator access required." };
		const input = parseDeliveryManifest({ ...args, limit: 1 });
		const manifest = await graphOperation<{
			documentIds: string[];
			nextOffset: number | null;
		}>("delivery.document_manifest", input);
		const outcomes = [];
		for (const id of manifest.documentIds)
			outcomes.push(await tryIndexDeliveryDocument(id));
		return {
			success: true,
			data: { outcomes, nextOffset: manifest.nextOffset },
		};
	},
};
