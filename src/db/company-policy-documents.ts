import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./schema";

export const companyPolicyDocuments = sqliteTable("company_policy_documents", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	description: text("description"),
	r2Key: text("r2_key").unique().notNull(),
	fileName: text("file_name").notNull(),
	mimeType: text("mime_type").notNull(),
	sizeBytes: integer("size_bytes").notNull(),
	uploadedById: text("uploaded_by_id").references(() => users.id),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});
