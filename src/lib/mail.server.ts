type SendMailInput = {
	to: string | string[];
	subject: string;
	text: string;
};

/**
 * Email delivery is intentionally disabled until the Cloudflare provider is
 * finalized. In-app notifications remain the source of truth.
 */
export async function sendMail({ to, subject, text }: SendMailInput) {
	void to;
	void subject;
	void text;
	console.info("Email skipped: no provider configured.");
}
