import { createFileRoute } from "@tanstack/react-router";
import { downloadCompanyPolicyDocument } from "@/lib/company-policy-download.server";

export const Route = createFileRoute(
	"/api/company-policies/$documentId/download",
)({
	server: {
		handlers: {
			GET: ({ params }) => downloadCompanyPolicyDocument(params.documentId),
		},
	},
});
