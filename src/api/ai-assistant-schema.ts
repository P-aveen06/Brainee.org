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
});

export const rejectProposalSchema = z.object({
	proposalId: z.string().min(1),
});

export const deleteConversationSchema = z.object({
	conversationId: z.string().min(1),
});
