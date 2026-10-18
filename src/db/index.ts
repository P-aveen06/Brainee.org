import { GraphDatabase } from "../../shared/graph/query";
import { graphOperation } from "./transport.server";

export function createDb() {
	return new GraphDatabase(graphOperation);
}
export type Database = ReturnType<typeof createDb>;
