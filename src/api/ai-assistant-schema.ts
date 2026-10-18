import { z } from "zod";
import { assistantPageContextSchema } from "@/lib/ai/page-context";

export const sendMessageSchema = z.object({
	conversationId: z.string().optional(),
	message: z.string().min(1, "Message cannot be empty").max(20_000),
	modelId: z.string().optional(),
	pageContext: assistantPageContextSchema.optional(),
});

export const getConversationSchema = z.object({
	conversationId: z.string().min(1),
});

export const confirmProposalSchema = z.object({
	proposalId: z.string().min(1),
	edits: z.object({
		title: z.string().trim().min(1).max(300),
		description: z.string().max(10000),
		estimateHours: z.number().min(0).max(100000).nullable(),
	}).strict().optional(),
});

export const rejectProposalSchema = z.object({
	proposalId: z.string().min(1),
});

export const deleteConversationSchema = z.object({
	conversationId: z.string().min(1),
});
