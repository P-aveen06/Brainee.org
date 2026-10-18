import start from "@tanstack/react-start/server-entry";
import {
	runDocumentIndexJob,
	type IndexJobEnvironment,
} from "./lib/ai/document-index-job";

export default {
	fetch: start.fetch,
	async scheduled(
		_event: ScheduledController,
		env: IndexJobEnvironment,
		ctx: ExecutionContext,
	) {
		ctx.waitUntil(runDocumentIndexJob(env));
	},
};
