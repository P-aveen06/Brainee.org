export interface GraphConfig {
	host: string;
	port: number;
	graphName: string;
	password: string;
	serviceToken: string;
}

export function readConfig(env: NodeJS.ProcessEnv): GraphConfig {
	const host = env.GRAPH_HOST?.trim();
	const graphName = env.GRAPH_NAME?.trim();
	const port = Number(env.GRAPH_PORT);
	if (
		!host ||
		!graphName ||
		!/^brainee_(dev|test_[a-z0-9_]+)$/.test(graphName)
	) {
		throw new Error("Set GRAPH_HOST and a supported local GRAPH_NAME.");
	}
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error("GRAPH_PORT must be a valid TCP port.");
	}
	if (!env.GRAPH_APP_PASSWORD || env.GRAPH_APP_PASSWORD.length < 32) {
		throw new Error("GRAPH_APP_PASSWORD must contain at least 32 characters.");
	}
	if (!env.GRAPH_SERVICE_TOKEN || env.GRAPH_SERVICE_TOKEN.length < 32) {
		throw new Error("GRAPH_SERVICE_TOKEN must contain at least 32 characters.");
	}
	return {
		host,
		port,
		graphName,
		password: env.GRAPH_APP_PASSWORD,
		serviceToken: env.GRAPH_SERVICE_TOKEN,
	};
}
